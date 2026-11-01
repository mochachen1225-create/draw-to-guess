import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; LANG = sys.argv[2]; OUT = sys.argv[3]
RAW = f'{D}/raw'; W, H, FPS = 1080, 1920, 30
F = lambda n: ImageFont.truetype(f'{D}/huninn.ttf', n)
INK = (58, 46, 42)
CAPS = {
 'en': {'couch1': "2 phones. 1 friend.", 'peek': "Peek at the prompt…\nyou get 2 seconds", 'blind': "…then the screen\ngoes BLACK", 'guess': "Your friend guesses LIVE",
        'twist': "Twist rounds!", 'replay': "Then the replay…", 'couch2': "…and you lose it", 'solo': "No friend? The computer\ndraws for you. Badly."},
 'zh': {'couch1': "兩支手機，一個朋友", 'peek': "偷看題目…\n只有 2 秒", 'blind': "…然後螢幕全黑", 'guess': "朋友看線條即時搶答",
        'twist': "還有搞怪回合！", 'replay': "最後看重播…", 'couch2': "…然後笑到崩潰", 'solo': "沒朋友？電腦畫給你猜\n（畫得超爛）"}}[LANG]
def caption(text, color, path):
    lines = text.split('\n'); f = F(76 if LANG == 'en' else 82)
    d0 = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    w = max(d0.textlength(l, font=f) for l in lines) + 80; h = len(lines) * (f.size + 22) + 50
    im = Image.new('RGBA', (int(w) + 20, int(h) + 20), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, w + 8, h + 8], 30, fill=INK); d.rounded_rectangle([0, 0, w, h], 30, fill=color, outline=INK, width=6)
    y = 25
    for l in lines:
        lw = d.textlength(l, font=f); d.text(((w - lw) / 2, y), l, font=f, fill=(255, 255, 255), stroke_width=7, stroke_fill=INK); y += f.size + 22
    im = im.rotate(-2.5, resample=Image.BICUBIC, expand=True); im.save(path)
    return im.size
def run(cmd): subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
tmp = f'{D}/seg_{LANG}'; os.makedirs(tmp, exist_ok=True)
segs = []
def finish(src_args, vf_core, dur, name, cap=None, cap_y=110, color=(255, 90, 90)):
    out = f'{tmp}/{name}.mp4'; inputs = list(src_args); filt = vf_core
    if cap:
        cw, ch = caption(cap, color, f'{tmp}/{name}_cap.png')
        inputs += ['-loop', '1', '-i', f'{tmp}/{name}_cap.png']
        # 字卡從上方滑進來
        filt += f";[v][1:v]overlay=x=(W-w)/2:y='if(lt(t,0.25),{cap_y}-300+300*t/0.25,{cap_y})':shortest=1[o]"
        filt = filt.replace('[v]', '[v]', 1)
    else:
        filt += ";[v]null[o]"
    run(['ffmpeg', '-y', *inputs, '-filter_complex', filt, '-map', '[o]', '-t', f'{dur}', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out])
    segs.append(out)
def frames(name, dur, start=0.0, speed=1.0, fps_in=None):
    d = f'{RAW}/{LANG}-{name}'; tj = f'{d}/times.json'
    if os.path.exists(tj): times = json.load(open(tj))
    else:
        fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg')); times = [[f'{d}/{f}', i / 30] for i, f in enumerate(fs)]
    lst = f'{tmp}/{name}.txt'; sel = [(f, t) for f, t in times if t >= start]
    with open(lst, 'w') as fh:
        acc = 0
        for i, (f, t) in enumerate(sel):
            nxt = sel[i + 1][1] if i + 1 < len(sel) else t + 1 / 10
            dt = (nxt - t) / speed; fh.write(f"file '{f}'\nduration {dt:.4f}\n"); acc += dt
            if acc >= dur: break
        fh.write(f"file '{sel[min(i, len(sel) - 1)][0]}'\n")
    return ['-f', 'concat', '-safe', '0', '-i', lst]
GAME_VF = "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08[bg];[b]scale=960:1920[fg];[bg][fg]overlay=(W-w)/2:0,fps=30[v]"
STILL_VF = "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08[bg];[b]scale=960:1920,zoompan=z='1+0.0015*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=960x1920:fps=30[fg];[bg][fg]overlay=(W-w)/2:0[v]"
ANIM_VF = "[0:v]scale=1080:1920,fps=30[v]"
COUCH_VF = "[0:v]scale=1080:1920,fps=30[v]"
# 時間軸（配合音樂：9.0 秒靜音、10.5 秒爆開、25 秒收尾）
frames('intro', 3.0); finish(frames('intro', 3.0), ANIM_VF, 3.0, '01_intro')
finish(['-ss', '0.4', '-i', f'{D}/couch.mp4'], COUCH_VF, 3.0, '02_couch', CAPS['couch1'], 1380, (255, 160, 60))
finish(['-loop', '1', '-i', f'{RAW}/{LANG}-peek.png'], STILL_VF, 3.0, '03_peek', CAPS['peek'], 1320, (255, 90, 90))
finish(frames('blind', 1.5), GAME_VF, 1.5, '04_blind', CAPS['blind'], 1250, (90, 90, 90))
finish(frames('guess', 3.0, start=0.8, speed=1.2), GAME_VF, 3.0, '05_guess', CAPS['guess'], 90, (255, 90, 90))
finish(['-loop', '1', '-i', f'{RAW}/{LANG}-twist.png'], STILL_VF, 2.5, '06_twist', CAPS['twist'], 1350, (255, 170, 40))
finish(frames('replay', 3.0, start=0.3, speed=1.3), GAME_VF, 3.0, '07_replay', CAPS['replay'], 1500, (120, 120, 255))
finish(['-ss', '4.8', '-i', f'{D}/couch.mp4'], COUCH_VF, 3.0, '08_couch', CAPS['couch2'], 1450, (255, 90, 90))
finish(frames('solo', 3.0, start=0.5, speed=1.7), GAME_VF, 3.0, '09_solo', CAPS['solo'], 1500, (60, 160, 255))
finish(frames('end', 3.4), ANIM_VF, 3.4, '10_end')
# 接起來＋配樂（13～22 秒＋40～59.4 秒）
with open(f'{tmp}/all.txt', 'w') as fh:
    for s in segs: fh.write(f"file '{s}'\n")
run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', f'{tmp}/all.txt', '-c', 'copy', f'{tmp}/video.mp4'])
run(['ffmpeg', '-y', '-i', f'{D}/music.mp3', '-filter_complex',
     "[0:a]atrim=13:22,asetpts=PTS-STARTPTS,afade=t=out:st=8.94:d=0.06[a1];[0:a]atrim=40:59.4,asetpts=PTS-STARTPTS[a2];[a1][a2]concat=n=2:v=0:a=1,afade=t=in:d=0.3[a]",
     '-map', '[a]', f'{tmp}/music.m4a'])
run(['ffmpeg', '-y', '-i', f'{tmp}/video.mp4', '-i', f'{tmp}/music.m4a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', OUT])
print('built', OUT)
