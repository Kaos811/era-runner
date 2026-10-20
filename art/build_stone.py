#!/usr/bin/env python3
"""Era Runner art pipeline: green-screen source paintings -> clean transparent WebP sprites.
Usage: python3 art/build_stone.py [srcdir]   (default /workspace/era-runner-art/src)
Each sprite is fitted (keeping aspect) into the exact texture box the code-drawn art used,
so every existing setScale() in the game keeps working. See ART.md."""
import sys, os, numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/era-runner-art/src'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'eras', 'stone')
os.makedirs(OUT, exist_ok=True)

def key_green(im, lo=90, hi=140):
    """Chroma-key a saturated green-screen background (~#00FF00). Foliage greens are far less
    saturated (green dominance < ~75), so they survive; the screen (dominance 150-230) goes."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dom = g - np.maximum(r, b)
    alpha = np.clip(1.0 - (dom - lo) / (hi - lo), 0, 1)
    img = Image.fromarray(alpha.astype(np.float32) * 255).convert('L')
    al = np.asarray(img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
    # despill: near edges (or wherever green still dominates strongly) cap green at max(r, b)
    edge = (al < 0.99) | (dom > 60)
    g2 = np.where(edge, np.minimum(g, np.maximum(r, b) + 8), g)
    return Image.fromarray(np.dstack([r, g2, b, al * 255]).astype(np.uint8), 'RGBA')

def trim(img, pad=2):
    bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    return img.crop(bb) if bb else img

def premult_resize(img, size):
    a = np.asarray(img).astype(np.float32) / 255
    rgb = a[..., :3] * a[..., 3:4]
    pm = Image.fromarray((np.dstack([rgb, a[..., 3:4]]) * 255).astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)
    b = np.asarray(pm).astype(np.float32) / 255
    al = np.clip(b[..., 3:4], 1e-4, 1)
    rgb = np.clip(b[..., :3] / al, 0, 1)
    return Image.fromarray((np.dstack([rgb, b[..., 3:4]]) * 255).astype(np.uint8), 'RGBA')

def fit(img, W, H, fill=0.96, anchor='bottom', bottom_bleed=0.0):
    """Fit into WxH canvas. anchor bottom = feet on the bottom edge (origin 0.5,1 in game)."""
    img = trim(img)
    s = min(W * fill / img.width, H * fill / img.height)
    nw, nh = max(1, round(img.width * s)), max(1, round(img.height * s))
    img = premult_resize(img, (nw, nh))
    can = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = (W - nw) // 2
    y = H - nh if anchor == 'bottom' else (H - nh) // 2
    can.alpha_composite(img, (x, y))
    return can

def save(img, name, q=88):
    p = os.path.join(OUT, name + '.webp')
    img.save(p, 'WEBP', quality=q, method=6, alpha_quality=95)
    print(f'{name:22s} {img.size} {os.path.getsize(p)//1024} KB')

def src(n): return Image.open(os.path.join(SRC, n))
def crop_frac(img, l, t, r, b):
    w, h = img.size; return img.crop((int(l*w), int(t*h), int(r*w), int(b*h)))

# --- enemies: 160x200 box, feet at bottom (matches code-drawn enemy_* textures)
save(fit(key_green(src('caveman.jpg')), 160, 200), 'enemy')
save(fit(key_green(src('cavewoman.jpg'), 70, 115), 160, 200), 'enemy_b')
save(fit(key_green(src('brute.jpg')), 160, 200, fill=0.99), 'enemy_big')
save(fit(key_green(src('boar.jpg')), 160, 200, fill=0.92), 'enemy_charger')
# --- boss: 2x of the 520x440 code texture (game scales it by 0.5 when HD art is present)
save(fit(key_green(src('mammoth.jpg')), 1040, 880, fill=0.98), 'boss', q=86)
# --- weapons: 220x300 box, origin (0.5, 0.92) in game; the hand runs off the bottom edge
save(fit(key_green(src('sling.jpg')), 220, 300, fill=1.0), 'weapon_sling')
save(fit(key_green(src('rockhand.jpg')), 220, 300, fill=0.95), 'weapon_rock')
def wrist(img):
    """(width, center x) of the arm where it leaves the bottom of a trimmed sprite."""
    al = np.asarray(img.getchannel('A'))[-max(3, img.height // 40):] > 128
    xs = np.where(al.any(0))[0]
    return xs.max() - xs.min() + 1, (xs.max() + xs.min()) / 2

if os.path.exists(os.path.join(SRC, 'rockhand_open.jpg')):
    # empty hand at release: color-matched to the closed hand, scaled/placed so the wrists line up
    closed = trim(key_green(src('rockhand.jpg')))
    W, H, FILL = 220, 300, 0.95
    sc_c = min(W * FILL / closed.width, H * FILL / closed.height)
    cw, ccx = wrist(closed)
    cx_final = (W - round(closed.width * sc_c)) // 2 + ccx * sc_c   # closed wrist center in the canvas
    opened = trim(key_green(src('rockhand_open.jpg')))
    # per-channel gain so the open hand's average skin matches the closed hand's
    def skin_mean(im):
        a = np.asarray(im).astype(np.float32); m = a[..., 3] > 200
        rgb = a[..., :3][m]; mx, mn = rgb.max(1), rgb.min(1)
        sk = rgb[(mx - mn) / np.maximum(mx, 1) > 0.25]           # warm skin, not grey rock
        return sk.mean(0)
    gain = skin_mean(closed) / skin_mean(opened)
    a = np.asarray(opened).astype(np.float32); a[..., :3] = np.clip(a[..., :3] * gain, 0, 255)
    opened = Image.fromarray(a.astype(np.uint8), 'RGBA')
    ow, ocx = wrist(opened)
    sc_o = (cw * sc_c) / ow
    nw, nh = round(opened.width * sc_o), round(opened.height * sc_o)
    o2 = premult_resize(opened, (nw, nh))
    can = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    can.alpha_composite(o2.crop((0, max(0, nh - H), nw, nh)) if nh > H else o2, (0, 0)) if False else None
    x = round(cx_final - ocx * sc_o); y = H - nh
    can.paste(o2, (x, y), o2)
    print('open hand gain', np.round(gain, 3), 'scale', round(sc_o / sc_c, 3))
    save(can, 'weapon_rock_open')

# --- props sheet (2x2): crate, boulder, fern, rocks
props = key_green(src('props.jpg'))
save(fit(crop_frac(props, 0, 0, .5, .5), 260, 224, fill=0.92), 'crate')
save(fit(crop_frac(props, .5, 0, 1, .5), 180, 160, fill=0.98), 'block')
save(fit(crop_frac(props, 0, .5, .5, 1), 300, 260, fill=1.0), 'decor_fern')
save(fit(crop_frac(props, .5, .5, 1, 1), 300, 220, fill=1.0), 'decor_rocks')
ps = key_green(src('palm_stone.jpg'))
save(fit(crop_frac(ps, 0, 0, .5, 1), 260, 360, fill=1.0), 'decor_palm')
stone = trim(crop_frac(ps, .5, 0, 1, 1))
save(fit(stone, 44, 44, fill=0.92, anchor='center'), 'p_pebble')
save(fit(stone, 36, 36, fill=0.95, anchor='center'), 'p_rock')
save(fit(stone, 80, 80, fill=0.95, anchor='center'), 'bp_rock')
# --- background: opaque, horizon of the painting placed on the game's HY line by code
bg = src('bg_stone.jpg').convert('RGB')
bg = bg.resize((640, round(bg.height * 640 / bg.width)), Image.LANCZOS)
p = os.path.join(OUT, 'bg.webp'); bg.save(p, 'WEBP', quality=80, method=6); print('bg', bg.size, os.path.getsize(p)//1024, 'KB')
