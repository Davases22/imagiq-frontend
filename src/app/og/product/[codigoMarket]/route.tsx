import { ImageResponse } from "next/og";

export const runtime = "edge";

// Brand
const SAMSUNG_BLUE = "#1428A0";
const INK = "#0a0a0a";

interface ProductMeta {
  codigoMarket: string;
  name: string;
  price: number;
  priceNormal: number;
  image: string | null;
  inStock: boolean;
}

function formatCop(value: number): string {
  if (!value || value <= 0) return "";
  const grouped = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${grouped}`;
}

/** Force a satori-friendly JPG render of a Cloudinary image (avoids webp/avif). */
function toSatoriImage(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    return url.replace(
      /\/image\/upload\/(?:[^/]+\/)?/,
      "/image/upload/f_jpg,q_80,w_760,c_pad,b_white/",
    );
  }
  return url;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ codigoMarket: string }> },
) {
  const { codigoMarket } = await params;
  const origin = new URL(req.url).origin;

  let meta: ProductMeta | null = null;
  try {
    const res = await fetch(
      `${origin}/api/products/${encodeURIComponent(codigoMarket)}/meta`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as ProductMeta | null;
      if (data && data.codigoMarket) meta = data;
    }
  } catch {
    meta = null;
  }

  const name = meta?.name || "Samsung Store";
  const photo = toSatoriImage(meta?.image ?? null);
  const price = formatCop(meta?.price ?? 0);
  const hadDiscount =
    !!meta && meta.priceNormal > 0 && meta.price > 0 && meta.priceNormal > meta.price;

  const cacheHeaders = {
    "Cache-Control":
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          backgroundColor: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: product photo on a clean white panel (matches the right side,
            no visible "background" — Samsung-style). */}
        <div
          style={{
            width: "560px",
            height: "630px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={name}
              width={480}
              height={480}
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div style={{ display: "flex", fontSize: 48, color: SAMSUNG_BLUE }}>
              Samsung Store
            </div>
          )}
        </div>

        {/* Right: brand + name + price */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              color: SAMSUNG_BLUE,
              letterSpacing: "1px",
            }}
          >
            SAMSUNG STORE
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 52,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.1,
              maxWidth: "560px",
            }}
          >
            {name.length > 80 ? `${name.slice(0, 80)}…` : name}
          </div>
          {price ? (
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 28, gap: 16 }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: SAMSUNG_BLUE }}>
                {price}
              </div>
              {hadDiscount ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 26,
                    color: "#9aa0a6",
                    textDecoration: "line-through",
                    paddingBottom: 6,
                  }}
                >
                  {formatCop(meta!.priceNormal)}
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 36, fontSize: 24, color: "#5f6368" }}>
            Distribuidor oficial Samsung · Envío a toda Colombia
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: cacheHeaders },
  );
}
