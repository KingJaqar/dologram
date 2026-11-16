"""Compose the existing logo and Inter wordmark for Expo's native splash plugin.

Authoring utility only; requires Pillow. Run from any working directory.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import re

root = Path(__file__).resolve().parents[1]
assets = root / 'apps/mobile/assets/logo'
tokens = (root / 'packages/shared/src/theme/tokens.ts').read_text()
colors = {key: re.search(rf"{key}: '(#[0-9A-Fa-f]+)'", tokens)[1]
          for key in ('deepCharcoal', 'warmIvory')}
logo = Image.open(assets / 'dologram_logo.png').convert('RGBA')
logo = logo.crop(logo.getchannel('A').getbbox())
logo.thumbnail((400, 380), Image.Resampling.LANCZOS)
font = ImageFont.truetype(str(root / 'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'), 78)
for scheme, text_color in [('light', colors['deepCharcoal']), ('dark', colors['warmIvory'])]:
    canvas = Image.new('RGBA', (768, 768))
    canvas.alpha_composite(logo, ((768 - logo.width) // 2, 130))
    ImageDraw.Draw(canvas).text((384, 582), 'DoloGram', font=font, fill=text_color, anchor='mm')
    canvas.save(assets / f'dologram_splash_{scheme}.png')
    # Keep all artwork within Android's circular splash icon safe area after scaling.
    x0, y0, x1, y1 = canvas.getchannel('A').getbbox()
    assert max(((x-384)**2+(y-384)**2)**0.5 for x,y in [(x0,y0),(x1,y0),(x0,y1),(x1,y1)]) < 460
print('Generated light/dark logo + DoloGram splash artwork.')
