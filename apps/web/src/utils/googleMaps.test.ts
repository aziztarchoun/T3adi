import { describe, expect, it } from "vitest";
import { parseGoogleMapsCoordinates } from "./googleMaps";

describe("parseGoogleMapsCoordinates", () => {
  it("parses an at-coordinate Google Maps URL", () => {
    expect(
      parseGoogleMapsCoordinates(
        "https://www.google.com/maps/@36.8065,10.1815,17z",
      ),
    ).toEqual({ lat: 36.8065, lng: 10.1815 });
  });

  it("parses a query-coordinate Google Maps URL", () => {
    expect(
      parseGoogleMapsCoordinates("https://maps.google.com/?q=36.8065,10.1815"),
    ).toEqual({ lat: 36.8065, lng: 10.1815 });
  });

  it("rejects unsupported or invalid links", () => {
    expect(
      parseGoogleMapsCoordinates("https://example.com/maps/@1,2,12z"),
    ).toBeNull();
    expect(
      parseGoogleMapsCoordinates("https://www.google.com/maps?q=95,10"),
    ).toBeNull();
    expect(parseGoogleMapsCoordinates("Tunis")).toBeNull();
  });
});
