import { describe, expect, it } from "vitest";
import { COUNTRIES, countryFromTimeZone, guessCountry } from "@/lib/location";

describe("guessCountry", () => {
  it.each([
    [{ languages: ["en-GB", "en"] }, "GB"],
    [{ languages: ["pt-BR", "pt", "en"] }, "BR"],
    [{ languages: ["zh-Hant-TW"] }, "TW"],
    [{ languages: ["en-US-u-ca-gregory"] }, "US"],
    [{ languages: ["es-419", "es-MX"] }, "MX"],
    [{ languages: ["de"] }, "DE"],
    [{ languages: ["ja"] }, "JP"],
    [{ languages: ["en", "es", "pt"] }, null],
    [{ languages: [] }, null],
    [{}, null],
    [{ timeZone: "America/New_York" }, "US"],
    [{ timeZone: "Europe/London" }, "GB"],
    [{ timeZone: "Europe/Berlin" }, "DE"],
    [{ timeZone: "Asia/Tokyo" }, "JP"],
    [{ timeZone: "Australia/Sydney" }, "AU"],
    [{ timeZone: "America/Sao_Paulo" }, "BR"],
    [{ timeZone: "Asia/Kolkata" }, "IN"],
    [{ timeZone: "Asia/Calcutta" }, "IN"],
    [{ timeZone: "Asia/Ho_Chi_Minh" }, "VN"],
    [{ timeZone: "Europe/Kyiv" }, "UA"],
    [{ timeZone: "America/Argentina/Buenos_Aires" }, "AR"],
    [{ timeZone: "Pacific/Honolulu" }, "US"],
    [{ timeZone: "America/Puerto_Rico" }, "PR"],
    [{ timeZone: "Africa/Lagos" }, "NG"],
    [{ timeZone: "Asia/Dubai" }, "AE"],
    [{ timeZone: "america/toronto" }, "CA"],
    [{ timeZone: "UTC" }, null],
    [{ timeZone: "Etc/GMT+5" }, null],
    [{ timeZone: "Mars/Olympus_Mons" }, null],
  ])("%j -> %s", (input, expected) => {
    expect(guessCountry(input)).toBe(expected);
  });

  it("prefers the time zone over the browser language", () => {
    // An English-language browser in Germany is most likely used in Germany.
    expect(guessCountry({ languages: ["en-US", "en"], timeZone: "Europe/Berlin" })).toBe("DE");
    expect(guessCountry({ languages: ["en-GB"], timeZone: "America/Chicago" })).toBe("US");
    expect(guessCountry({ languages: ["en-GB"], timeZone: "UTC" })).toBe("GB");
  });

  it("lets the language pick a country that shares its time zone", () => {
    expect(guessCountry({ languages: ["sq-XK"], timeZone: "Europe/Belgrade" })).toBe("XK");
    expect(guessCountry({ languages: ["sr-RS"], timeZone: "Europe/Belgrade" })).toBe("RS");
  });

  it("ignores junk", () => {
    const junk = { languages: [42, null, "", "x", "en-ZZ", "--"] as unknown as string[], timeZone: 7 as unknown as string };
    expect(() => guessCountry(junk)).not.toThrow();
    expect(guessCountry(junk)).toBeNull();
  });
});

describe("countryFromTimeZone", () => {
  it("maps every zone this runtime knows to a listed country (except disputed Simferopol)", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    const unmapped: string[] = [];
    for (const zone of Intl.supportedValuesOf("timeZone")) {
      const country = countryFromTimeZone(zone);
      if (!country) unmapped.push(zone);
      else expect(codes.has(country), zone).toBe(true);
    }
    expect(unmapped).toEqual(["Europe/Simferopol"]);
  });
});
