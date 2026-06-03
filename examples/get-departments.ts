import { OpenPlatform, type SignableParams } from "../src";

interface GetDepartmentsResponse {
  stat?: {
    code?: number;
    codename?: string;
    systime?: number;
  };
  result?: string;
  data?: {
    total?: number;
    rows?: Array<{
      id: number;
      name: string;
      address?: string;
      phone?: string;
      groupId?: number;
      organizeId?: number;
      organizeName?: string;
      shopId?: string;
    }>;
  };
  code?: string;
  message?: string;
  isError?: boolean;
}

interface SsoLoginResponse {
  stat?: {
    code?: number;
    codename?: string;
    systime?: number;
  };
  result?: string;
  data?: {
    result?: string;
    userName?: string;
    userId?: number;
    enterpriseId?: number;
    token?: string;
    tokenExpirationTimestamp?: number;
    tokenExpirationSurplusTimestamp?: number;
  };
  code?: string;
  message?: string;
  isError?: boolean;
}

const params: SignableParams = {
  pageNumber: Bun.env.OVOPARK_PAGE_NUMBER ?? "1",
  pageSize: Bun.env.OVOPARK_PAGE_SIZE ?? "20",
};

addOptionalParam(params, "deptName", Bun.env.OVOPARK_DEPT_NAME);
addOptionalParam(params, "nodeIds", Bun.env.OVOPARK_NODE_IDS);
addOptionalParam(params, "startTime", Bun.env.OVOPARK_START_TIME);
addOptionalParam(params, "endTime", Bun.env.OVOPARK_END_TIME);

const client = new OpenPlatform({
  url: Bun.env.OVOPARK_URL ?? "https://cloudapi.ovopark.com/cloud.api",
  aid: env("OVOPARK_APP_ID", "OVOPARK_AID") ?? "DC******51",
  akey: env("OVOPARK_ACCESS_KEY_ID", "OVOPARK_AKEY") ?? "b2******fe",
  asecret: env("OVOPARK_ACCESS_KEY_SECRET", "OVOPARK_ASECRET") ?? "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  mt: "open.organize.departments.getDepartments",
  requestMode: "post",
});

const loginClient = new OpenPlatform({
  url: Bun.env.OVOPARK_URL ?? "https://cloudapi.ovopark.com/cloud.api",
  aid: env("OVOPARK_APP_ID", "OVOPARK_AID") ?? "DC******51",
  akey: env("OVOPARK_ACCESS_KEY_ID", "OVOPARK_AKEY") ?? "b2******fe",
  asecret: env("OVOPARK_ACCESS_KEY_SECRET", "OVOPARK_ASECRET") ?? "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  mt: "open.shopweb.security.ssoLogin",
  requestMode: "post",
});

const loginParams = buildLoginParams();
const signedParams = client.createSignedParams(params, "20260323145909");
const signedLoginParams = loginClient.createSignedParams(loginParams, "20260521092050");

console.log("SSO login signed params preview:");
console.log(maskSensitiveParams(signedLoginParams));
console.log("\nGet departments signed params preview:");
console.log(signedParams);

if (!Bun.argv.includes("--request")) {
  console.log("\nPass --request to call open.shopweb.security.ssoLogin, then open.organize.departments.getDepartments.");
  process.exit(0);
}

const appId = env("OVOPARK_APP_ID", "OVOPARK_AID");
const accessKeyId = env("OVOPARK_ACCESS_KEY_ID", "OVOPARK_AKEY");
const accessKeySecret = env("OVOPARK_ACCESS_KEY_SECRET", "OVOPARK_ASECRET");
const userName = Bun.env.OVOPARK_USERNAME;
const password = Bun.env.OVOPARK_PASSWORD;
const passwordMd5 = Bun.env.OVOPARK_PASSWORD_MD5;

if (!appId || !accessKeyId || !accessKeySecret) {
  throw new Error(
    "Missing credentials. Set OVOPARK_APP_ID, OVOPARK_ACCESS_KEY_ID, and OVOPARK_ACCESS_KEY_SECRET.",
  );
}

if (!userName || (!password && !passwordMd5)) {
  throw new Error(
    "Missing login credentials. Set OVOPARK_USERNAME and OVOPARK_PASSWORD, or set OVOPARK_USERNAME and OVOPARK_PASSWORD_MD5.",
  );
}

const ovoAuthorization = await fetchOvoAuthorization(loginClient, loginParams);

const result = await client.request<GetDepartmentsResponse>(params, {
  headers: {
    "ovo-authorization": ovoAuthorization,
  },
});

console.log("Response:");
console.log(result);

if (result.data?.rows?.length) {
  console.log("\nStores:");
  for (const row of result.data.rows) {
    console.log(`${row.id}\t${row.name}\t${row.shopId ?? ""}`);
  }
}

function addOptionalParam(params: SignableParams, key: string, value: string | undefined): void {
  if (value !== undefined && value !== "") {
    params[key] = value;
  }
}

function buildLoginParams(): SignableParams {
  const userName = Bun.env.OVOPARK_USERNAME ?? "your-username";
  const passwordMd5 = Bun.env.OVOPARK_PASSWORD_MD5 ?? md5Hex(Bun.env.OVOPARK_PASSWORD ?? "your-password");

  return {
    userName,
    password: passwordMd5,
  };
}

async function fetchOvoAuthorization(client: OpenPlatform, params: SignableParams): Promise<string> {
  const response = await client.request<SsoLoginResponse>(params);
  const token = response.data?.token;

  if (!token) {
    throw new Error(`ssoLogin did not return data.token: ${JSON.stringify(response)}`);
  }

  return token;
}

function md5Hex(value: string): string {
  return new Bun.CryptoHasher("md5").update(value).digest("hex");
}

function maskSensitiveParams(params: SignableParams): SignableParams {
  return {
    ...params,
    password: "********",
  };
}

function env(primary: string, fallback: string): string | undefined {
  return Bun.env[primary] || Bun.env[fallback];
}
