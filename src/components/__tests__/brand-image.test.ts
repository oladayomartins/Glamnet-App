import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { BrandImage } from "@/components/brand-image";
import { HERO_IMAGE_PATH } from "@/lib/imagekit";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
});

const render = (props: Parameters<typeof BrandImage>[0]) =>
  renderToStaticMarkup(createElement(BrandImage, props));

const heroProps = {
  path: HERO_IMAGE_PATH,
  alt: "A client with fresh braids and evening makeup at home",
  width: 1600,
  height: 600,
  priority: true,
};

describe("BrandImage", () => {
  it("renders an image with no ImageKit configuration present", () => {
    // This is the regression. The hero rendered as a gradient on production
    // because every image was gated behind an environment variable that was
    // never set, and nothing anywhere said so.
    const html = render(heroProps);

    expect(html).toContain("<img");
    expect(html).toContain("ik.imagekit.io/glamnetapp");
    expect(html).toContain("Hero%20Banner%20-%20Glamnet%20App.png");
  });

  it("reserves the box before the bytes arrive", () => {
    const html = render(heroProps);

    // Without intrinsic dimensions the hero shunts the page as it loads.
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="600"');
  });

  it("asks the CDN for the size it will actually display", () => {
    const html = render(heroProps);

    // 8:3 preserved at every offered width, so no candidate is a crop of a
    // different shape to the box it lands in — which for this banner would
    // move the subject out from under the copy.
    expect(html).toContain("tr=w-480,h-180");
    expect(html).toContain("tr=w-1440,h-540");
  });

  it("loads a priority image eagerly and anything else lazily", () => {
    expect(render(heroProps)).toContain('loading="eager"');
    expect(render({ ...heroProps, priority: false })).toContain(
      'loading="lazy"',
    );
  });

  it("follows a configured endpoint when there is one", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/moved";
    expect(render(heroProps)).toContain("ik.imagekit.io/moved");
  });
});
