import { describe, expect, it } from "vitest";
import {
  findExistingDuplicate,
  parseCsvRecords,
  parsePasswordCsv,
  passwordDuplicateKey,
  serializePasswordCsv,
  stripBom,
} from "./passwordCsv";

describe("parseCsvRecords", () => {
  it("handles quoted commas and newlines", () => {
    const rows = parseCsvRecords(
      'a,b\n"line1\nline2",c\n"x,y",z',
    );
    expect(rows).toEqual([
      ["a", "b"],
      ["line1\nline2", "c"],
      ["x,y", "z"],
    ]);
  });

  it("strips BOM", () => {
    expect(stripBom("\ufeffhello")).toBe("hello");
    const rows = parseCsvRecords("\ufeffname,password\nSite,secret");
    expect(rows[0][0]).toBe("name");
  });
});

describe("parsePasswordCsv", () => {
  it("parses Chrome format", () => {
    const csv = `name,url,username,password,note
GitHub,https://github.com,user@example.com,secret,2FA app`;
    expect(parsePasswordCsv(csv)).toEqual([
      {
        name: "GitHub",
        url: "https://github.com",
        username: "user@example.com",
        password: "secret",
        notes: "2FA app",
      },
    ]);
  });

  it("parses Firefox-style headers", () => {
    const csv = `url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
https://example.com,me@x.com,pw,,,,,,`;
    const rows = parsePasswordCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe("https://example.com");
    expect(rows[0].username).toBe("me@x.com");
    expect(rows[0].name).toBe("example.com");
  });

  it("skips rows without a password", () => {
    const csv = `name,url,username,password,note
Empty,https://a.com,user,,note
Ok,https://b.com,user,pass,`;
    expect(parsePasswordCsv(csv)).toHaveLength(1);
    expect(parsePasswordCsv(csv)[0].password).toBe("pass");
  });
});

describe("serializePasswordCsv", () => {
  it("round-trips through parse", () => {
    const original = [
      {
        name: "Site",
        url: "https://site.com",
        username: "u",
        password: "p",
        notes: 'note, with "quotes"',
      },
    ];
    const csv = serializePasswordCsv(original);
    expect(csv).toContain('"note, with ""quotes"""');
    expect(parsePasswordCsv(csv)).toEqual([
      {
        name: "Site",
        url: "https://site.com",
        username: "u",
        password: "p",
        notes: 'note, with "quotes"',
      },
    ]);
  });
});

describe("passwordDuplicateKey", () => {
  it("matches www and bare hostnames", () => {
    const a = passwordDuplicateKey("https://www.Example.com", "User@x.com");
    const b = passwordDuplicateKey("example.com", "user@x.com");
    expect(a).toBe(b);
  });
});

describe("findExistingDuplicate", () => {
  const existing = [
    {
      _id: "family",
      ownerId: "other",
      url: "https://github.com",
      username: "shared@example.com",
      name: "GitHub",
    },
    {
      _id: "mine",
      ownerId: "me",
      url: "https://www.github.com",
      username: "me@example.com",
      name: "GitHub",
    },
  ];

  it("prefers caller-owned entry", () => {
    const row = {
      url: "github.com",
      username: "me@example.com",
      name: "GitHub",
    };
    expect(findExistingDuplicate(existing, row, "me")?._id).toBe("mine");
  });

  it("returns family entry when caller has no match", () => {
    const row = {
      url: "https://github.com",
      username: "shared@example.com",
      name: "GitHub",
    };
    expect(findExistingDuplicate(existing, row, "me")?._id).toBe("family");
  });
});
