import { describe, expect, test } from "bun:test";
import {
  OpenPlatform,
  createSign,
  createSignedParams,
  formatTimestamp,
  toUrlSearchParams,
} from "../src";

describe("createSign", () => {
  test("matches the reference Python SDK sample", () => {
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

    expect(sign).toBe("B657F7CA341BB5C9C162603B9389DAA9");
  });

  test("sorts mixed-case parameter names with JavaScript code unit order", () => {
    const sign = createSign(
      {
        _aid: "S107",
        _akey: "S107-0000xxxx",
        _requestMode: "post",
        _sm: "md5",
        _timestamp: "20191128141620",
        _version: "v1",
        _mt: "open.shopweb.passengerFlow.getDataOfManyShopsHavingDevice",
        id: "S_153809",
        startTime: "2026-03-11 00:00:00",
        endTime: "2026-03-11 23:59:59",
        timeType: 1,
        starthour: 9,
        endhour: 24,
      },
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );

    expect(sign).toBe("7AC564C28C0EDC4AE01D6F0229893365");
  });
});

describe("OpenPlatform", () => {
  test("creates signed gateway params", () => {
    const client = new OpenPlatform({
      url: "https://example.test/m.api",
      akey: "S107-0000xxxx",
      asecret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      mt: "open.gateway.getBusinessOrg",
      requestMode: "post",
    });

    const params = client.createSignedParams(
      {
        orgid: 11111,
        starttime: "--------",
        endtime: "-----",
      },
      "20191128141620",
    );

    expect(params).toEqual(
      createSignedParams(
        {
          _aid: "S107",
          _akey: "S107-0000xxxx",
          _requestMode: "post",
          _sm: "md5",
          _timestamp: "20191128141620",
          _version: "v1",
          _mt: "open.gateway.getBusinessOrg",
        },
        {
          orgid: 11111,
          starttime: "--------",
          endtime: "-----",
        },
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      ),
    );
    expect(params._sig).toBe("B657F7CA341BB5C9C162603B9389DAA9");
  });

  test("returns signed params in deterministic code unit order", () => {
    const params = createSignedParams(
      {
        _aid: "S107",
        _akey: "S107-0000xxxx",
        _requestMode: "post",
        _sm: "md5",
        _timestamp: "20191128141620",
        _version: "v1",
        _mt: "open.shopweb.passengerFlow.getDataOfManyShopsHavingDevice",
      },
      {
        id: "S_153809",
        startTime: "2026-03-11 00:00:00",
        endTime: "2026-03-11 23:59:59",
        timeType: 1,
        starthour: 9,
        endhour: 24,
      },
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    );

    expect(Object.keys(params)).toEqual([
      "_aid",
      "_akey",
      "_mt",
      "_requestMode",
      "_sm",
      "_timestamp",
      "_version",
      "endTime",
      "endhour",
      "id",
      "startTime",
      "starthour",
      "timeType",
      "_sig",
    ]);
  });

  test("posts signed form params and parses json responses", async () => {
    let request: Request | undefined;

    const client = new OpenPlatform({
      url: "https://example.test/m.api",
      akey: "S107-0000xxxx",
      asecret: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      mt: "open.gateway.getBusinessOrg",
      requestMode: "post",
      fetch: async (input, init) => {
        request = input instanceof Request
          ? new Request(input, init)
          : new Request(input.toString(), init);

        return Response.json({ ok: true });
      },
    });

    const result = await client.request<{ ok: boolean }>({
      orgid: 11111,
      starttime: "--------",
      endtime: "-----",
    });

    expect(result).toEqual({ ok: true });
    expect(request?.method).toBe("POST");
    expect(request?.headers.get("content-type")).toBe("application/x-www-form-urlencoded; charset=UTF-8");

    const body = new URLSearchParams(await request?.text());
    expect(body.get("_akey")).toBe("S107-0000xxxx");
    expect(body.get("_mt")).toBe("open.gateway.getBusinessOrg");
    expect(body.get("_sig")).toMatch(/^[A-F0-9]{32}$/);
    expect(body.get("orgid")).toBe("11111");
  });
});

describe("helpers", () => {
  test("formats timestamps as yyyyMMddHHmmss", () => {
    expect(formatTimestamp(new Date(2019, 10, 28, 14, 16, 20))).toBe("20191128141620");
  });

  test("serializes params with string values matching signing", () => {
    expect(toUrlSearchParams({ a: 1, b: true, c: new Date(2019, 10, 28, 14, 16, 20) }).toString()).toBe(
      "a=1&b=true&c=20191128141620",
    );
  });
});
