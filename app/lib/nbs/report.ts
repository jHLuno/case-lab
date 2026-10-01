import type {
  NbsQuestionNumber,
  NbsQuestionReport,
  NbsQuestionSnapshot,
  NbsQuestionStats,
  NbsQuestionTexts,
  NbsReport,
  NbsScreenReport,
  NbsValidatedClustering,
} from "./contracts";

export function buildQuestionStats(snapshot: NbsQuestionSnapshot, clustering: NbsValidatedClustering): NbsQuestionStats {
  const answersById = new Map(snapshot.answers.map((answer) => [answer.answerId, answer]));
  if (answersById.size !== snapshot.answers.length) throw new Error("Duplicate answer IDs in snapshot");

  const assigned = new Set<string>();
  const collator = new Intl.Collator("ru");
  const ordered = clustering.clusters.map((cluster) => {
    if (!cluster.clusterId || !cluster.title.trim() || Array.from(cluster.title.trim()).length > 120) {
      throw new Error("Invalid cluster title or ID");
    }
    if (cluster.title.trim().split(/\s+/u).length > 7) throw new Error("Cluster title exceeds seven words");
    const uniqueMembers = new Set(cluster.answerIds);
    if (uniqueMembers.size !== cluster.answerIds.length || uniqueMembers.size === 0) {
      throw new Error("Invalid cluster membership");
    }
    for (const id of uniqueMembers) {
      const answer = answersById.get(id);
      if (!answer || !answer.text.trim() || assigned.has(id)) throw new Error("Invalid cluster answer coverage");
      assigned.add(id);
    }
    return { clusterId: cluster.clusterId, title: cluster.title.trim(), count: uniqueMembers.size, memberIds: [...uniqueMembers] };
  });

  const exclusionIds = new Set<string>();
  for (const item of clustering.excluded) {
    const answer = answersById.get(item.answerId);
    if (!answer || !answer.text.trim() || assigned.has(item.answerId) || exclusionIds.has(item.answerId)) {
      throw new Error("Invalid excluded answer coverage");
    }
    exclusionIds.add(item.answerId);
  }

  const emptyCount = snapshot.answers.filter((answer) => !answer.text.trim()).length;
  const valid = ordered.reduce((sum, cluster) => sum + cluster.count, 0);
  const ignored = emptyCount + exclusionIds.size;
  if (valid + ignored !== snapshot.answers.length) throw new Error("Invalid answer coverage");
  if (new Set(ordered.map((cluster) => cluster.clusterId)).size !== ordered.length) throw new Error("Duplicate cluster IDs");

  ordered.sort((a, b) => b.count - a.count || collator.compare(a.title, b.title) || a.clusterId.localeCompare(b.clusterId));
  return {
    questionNumber: snapshot.questionNumber,
    question: snapshot.question,
    shortQuestion: snapshot.shortQuestion,
    total: snapshot.answers.length,
    valid,
    ignored,
    topClusters: ordered.slice(0, 5).map((cluster) => ({
      ...cluster,
      percent: valid === 0 ? 0 : Math.round((cluster.count / valid) * 100),
    })),
  };
}

export function buildQuestionReport(stats: NbsQuestionStats, texts: NbsQuestionTexts): NbsQuestionReport {
  if (texts.conclusion.length > 600) throw new Error("Question conclusion is too long");
  const explanations = new Map(texts.explanations.map((item) => [item.clusterId, item.explanation]));
  if (explanations.size !== texts.explanations.length || explanations.size !== stats.topClusters.length) {
    throw new Error("Question explanation coverage is incomplete");
  }
  const clusters = stats.topClusters.map((cluster) => {
    const explanation = explanations.get(cluster.clusterId);
    if (!explanation || explanation.length > 300) throw new Error("Invalid cluster explanation");
    return { title: cluster.title, count: cluster.count, percent: cluster.percent, explanation };
  });
  return {
    questionNumber: stats.questionNumber,
    question: stats.question,
    shortQuestion: stats.shortQuestion,
    total: stats.total,
    valid: stats.valid,
    ignored: stats.ignored,
    clusters,
    conclusion: texts.conclusion,
  };
}

export function buildNbsReport(
  context: { reportId: string; reportVersion: number; publishedAt: string },
  questions: NbsQuestionReport[],
  comparison: string,
): NbsReport {
  const byNumber = new Map<NbsQuestionNumber, NbsQuestionReport>();
  for (const question of questions) {
    if (byNumber.has(question.questionNumber)) throw new Error("Duplicate question report");
    byNumber.set(question.questionNumber, question);
  }
  if (byNumber.size !== 3 || !byNumber.has(1) || !byNumber.has(2) || !byNumber.has(3)) {
    throw new Error("All three question reports are required");
  }
  if (!context.reportId || !Number.isSafeInteger(context.reportVersion) || context.reportVersion < 1) {
    throw new Error("Invalid report version");
  }
  if (comparison.length > 1400) throw new Error("Forum comparison is too long");
  return {
    reportId: context.reportId,
    reportVersion: context.reportVersion,
    publishedAt: context.publishedAt,
    questions: [byNumber.get(1)!, byNumber.get(2)!, byNumber.get(3)!],
    comparison,
  };
}

export function toScreenReport(report: NbsReport): NbsScreenReport {
  return {
    reportId: report.reportId,
    reportVersion: report.reportVersion,
    questions: report.questions.map((question) => ({
      questionNumber: question.questionNumber,
      shortQuestion: question.shortQuestion,
      clusters: question.clusters.map((cluster) => ({ title: cluster.title, percent: cluster.percent })),
      insufficientClusters: question.clusters.length < 5,
    })),
  };
}

export function toFullReport(report: NbsReport): NbsReport {
  return {
    reportId: report.reportId,
    reportVersion: report.reportVersion,
    publishedAt: report.publishedAt,
    questions: report.questions.map((question) => ({
      questionNumber: question.questionNumber,
      question: question.question,
      shortQuestion: question.shortQuestion,
      total: question.total,
      valid: question.valid,
      ignored: question.ignored,
      clusters: question.clusters.map((cluster) => ({
        title: cluster.title,
        count: cluster.count,
        percent: cluster.percent,
        explanation: cluster.explanation,
      })),
      conclusion: question.conclusion,
    })) as NbsReport["questions"],
    comparison: report.comparison,
  };
}
