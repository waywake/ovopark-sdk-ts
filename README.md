# @waywake/ovopark-sdk

TypeScript SDK for the Ovopark open platform gateway.

## Install

```bash
bun add @waywake/ovopark-sdk
```

## Usage

```ts
import { OpenPlatform } from "@waywake/ovopark-sdk";

const client = new OpenPlatform({
  url: "https://cloudapi.ovopark.com/cloud.api",
  aid: "DC******51",
  akey: "b2******fe",
  asecret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  mt: "open.organize.departments.getDepartments",
  requestMode: "post",
});

const result = await client.request({
  pageNumber: "1",
  pageSize: "20",
});

console.log(result);
```

Requests are sent as `application/x-www-form-urlencoded` POSTs and default to a 30 second timeout.

## Example

```bash
bun run example
```

To send a real request:

```bash
OVOPARK_APP_ID="DC******51" \
OVOPARK_ACCESS_KEY_ID="b2******fe" \
OVOPARK_ACCESS_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
OVOPARK_USERNAME="username" \
OVOPARK_PASSWORD="password" \
bun run example --request
```

The example calls `open.organize.departments.getDepartments` at `https://cloudapi.ovopark.com/cloud.api`.
`AppID` maps to `_aid`, `AccessKey ID` maps to `_akey`, and `AccessKey Secret` is used to generate `_sig`.
Before requesting departments, the example calls `open.shopweb.security.ssoLogin` with `OVOPARK_USERNAME` and an MD5 password to get `Ovo-Authorization`.
You can pass an already-hashed password with `OVOPARK_PASSWORD_MD5` instead of `OVOPARK_PASSWORD`.

## Signing Only

```ts
import { createSign } from "@waywake/ovopark-sdk";

const sign = createSign(
  {
    _aid: "S107",
    _akey: "S107-0000xxxx",
    _requestMode: "post",
    _sm: "md5",
    _timestamp: 20191128141620,
    _version: "v1",
    _mt: "open.gateway.getBusinessOrg",
    orgid: 11111,
    starttime: "--------",
    endtime: "-----",
  },
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
);
```

The signature algorithm follows the Python SDK:

1. Merge gateway params and business params.
2. Sort params by key.
3. Concatenate `secret + key + value + ... + secret`.
4. Generate an MD5 hash and return it in uppercase.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```

## Publishing

Configure the repository secret `NPM_TOKEN`, then publish by pushing a semver tag that matches `package.json`.

```bash
bun run check
git tag v0.1.0
git push origin v0.1.0
```
