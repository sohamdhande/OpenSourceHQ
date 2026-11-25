import os
from PIL import Image, ImageDraw

def render_icon(size):
    # Render at 4x for high-quality supersampled anti-aliasing
    scale = 4
    w = size * scale
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Coordinates
    pad = int(18 * (w / 512.0))
    radius = int(112 * (w / 512.0))
    
    # Base rounded rectangle background (#0b0f19)
    draw.rounded_rectangle([pad, pad, w - pad, w - pad], radius=radius, fill=(11, 15, 25, 255))
    
    # Border (#38bdf8 / #6366f1)
    border_w = max(2, int(8 * (w / 512.0)))
    draw.rounded_rectangle([pad, pad, w - pad, w - pad], radius=radius, outline=(56, 189, 248, 120), width=border_w)

    # Terminal Chevron ">"
    # Points: (150, 170) -> (250, 256) -> (150, 342) scaled
    def pt(x, y):
        return (int(x * (w / 512.0)), int(y * (w / 512.0)))

    line_w = max(2, int(38 * (w / 512.0)))
    
    # Chevron lines
    draw.line([pt(150, 170), pt(250, 256)], fill=(56, 189, 248, 255), width=line_w)
    draw.line([pt(250, 256), pt(150, 342)], fill=(99, 102, 241, 255), width=line_w)
    
    # Chevron joint cap
    draw.circle(pt(250, 256), radius=line_w // 2, fill=(78, 145, 245, 255))
    draw.circle(pt(150, 170), radius=line_w // 2, fill=(56, 189, 248, 255))
    draw.circle(pt(150, 342), radius=line_w // 2, fill=(99, 102, 241, 255))

    # Underscore line (284, 342) -> (368, 342)
    accent_w = max(2, int(36 * (w / 512.0)))
    draw.line([pt(284, 342), pt(368, 342)], fill=(34, 211, 238, 255), width=accent_w)
    draw.circle(pt(284, 342), radius=accent_w // 2, fill=(34, 211, 238, 255))
    draw.circle(pt(368, 342), radius=accent_w // 2, fill=(34, 211, 238, 255))

    # Dot indicator (350, 190)
    dot_r = int(24 * (w / 512.0))
    draw.circle(pt(350, 190), radius=dot_r, fill=(56, 189, 248, 255))
    
    # Ring around dot
    ring_w = max(1, int(6 * (w / 512.0)))
    draw.circle(pt(350, 190), radius=int(36 * (w / 512.0)), outline=(56, 189, 248, 100), width=ring_w)

    # Downsample with Lanczos
    return img.resize((size, size), Image.Resampling.LANCZOS)

os.makedirs("public", exist_ok=True)
os.makedirs("src/app", exist_ok=True)

# Generate sizes
icon_16 = render_icon(16)
icon_32 = render_icon(32)
icon_48 = render_icon(48)
icon_180 = render_icon(180)
icon_512 = render_icon(512)

# Save ICO with multiple sizes
icon_32.save("public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
icon_32.save("src/app/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# Save PNGs
icon_180.save("public/apple-touch-icon.png", format="PNG")
icon_180.save("src/app/apple-icon.png", format="PNG")
icon_512.save("public/icon-512.png", format="PNG")
icon_32.save("src/app/icon.png", format="PNG")

print("Favicons and app icons generated successfully.")

