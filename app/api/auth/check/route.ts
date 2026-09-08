import { issueCrmCsrfToken, requireCrmAdmin } from "../../../lib/crm-auth.server";
import { noStoreJson } from "../../../lib/case-lab-3/http.server";

export async function GET() {
  try {
    const session = await requireCrmAdmin();
    if (!session) {
      return noStoreJson({ authenticated: false }, { status: 401 });
    }

    const csrfToken = issueCrmCsrfToken(session);
    return noStoreJson(
      { authenticated: true, csrfToken },
    );
  } catch {
    return noStoreJson({ error: "Service unavailable" }, { status: 503 });
  }
}
