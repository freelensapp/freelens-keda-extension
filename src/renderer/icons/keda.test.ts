import { describe, expect, it } from "vitest";
import svg from "./keda.svg?raw";

// The host renders the icon inline and fills every element of it with currentColor (`.Icon.svg svg * { fill:
// currentColor }` in its icon.scss), which overrides fill="none": an outline drawn with a stroke renders as a solid
// shape, and the black and white of a mask both turn into the icon's color.
describe("the sidebar icon", () => {
  it("is made of filled shapes, with no stroke, no unfilled shape and no mask", () => {
    expect(svg).not.toMatch(/\bstroke(-[a-z]+)?=/);
    expect(svg).not.toMatch(/fill="none"/);
    expect(svg).not.toMatch(/<mask\b/);
  });

  it("is on the 24x24 grid of the sidebar icons", () => {
    expect(svg).toMatch(/viewBox="0 0 24 24"/);
  });
});
