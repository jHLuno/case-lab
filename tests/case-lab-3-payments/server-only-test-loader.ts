import { createRequire } from "node:module";

const require = createRequire(__filename);
const serverOnlyPath = require.resolve("server-only");

if (!require.cache[serverOnlyPath]) {
  require.cache[serverOnlyPath] = {
    children: [],
    exports: {},
    filename: serverOnlyPath,
    id: serverOnlyPath,
    loaded: true,
    paths: [],
  } as unknown as NodeModule;
}

export const configModule = import("../../app/lib/case-lab-3/config.server");
export const crmAuthModule = import("../../app/lib/crm-auth.server");
export const httpModule = import("../../app/lib/case-lab-3/http.server");
export const providerHmacModule = import("../../app/lib/case-lab-3/provider-hmac.server");
export const jwtModule = import("../../app/lib/jwt");
