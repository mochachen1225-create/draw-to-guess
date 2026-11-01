import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; LANG = sys.argv[2]; OUT = sys.argv[3]
RAW = f'{D}/raw'; W, H, FPS = 1080, 1920, 30
F = lambda n: ImageFont.truetype(f'{D}/huninn.ttf', n)
INK = (58, 46, 42)
CAPS = {
 'en': {'couch1': "2 phones. 2 players.", 'peek': "Peek at the prompt…\nyou get 2 seconds", 'blind': "…then the screen\ngoes BLACK", 'guess': "Your friend guesses LIVE",
        'twist': "Twist rounds!", 'replay': "Then the replay…", 'couch2': "…and you lose it", 'solo': "No friend? The computer\ndraws for you. Badly."},
 'zh': {'couch1': "兩支手機，兩個人", 'peek': "偷看題目…\n只有 2 秒", 'blind': "…然後螢幕全黑", 'guess': "朋友看線條即時搶答",
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
def finish(src_args, vf_core, dur, name, cap=None, cap_y=110, color=(255, 90, 90), delay=0.0):
    out = f'{tmp}/{name}.mp4'; inputs = list(src_args); filt = vf_core
    if cap:
        cw, ch = caption(cap, color, f'{tmp}/{name}_cap.png')
        inputs += ['-loop', '1', '-i', f'{tmp}/{name}_cap.png']
        # 字卡從上方滑進來
        filt += f";[v][1:v]overlay=x=(W-w)/2:y='if(lt(t,{delay}+0.25),{cap_y}-300+300*max(0,t-{delay})/0.25,{cap_y})':enable='gte(t,{delay})':shortest=1[o]"
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
GAME_VF = "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08[bg];[b]scale=960:1920[fg];[bg][fg]overlay=(W-w)/2:0,fps=30,tpad=stop_mode=clone:stop_duration=3[v]"
STILL_VF = "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08[bg];[b]scale=960:1920,zoompan=z='1+0.0015*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=960x1920:fps=30[fg];[bg][fg]overlay=(W-w)/2:0,tpad=stop_mode=clone:stop_duration=3[v]"
ANIM_VF = "[0:v]scale=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=3[v]"
COUCH_VF = "[0:v]scale=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=3[v]"
# 時間軸（配合音樂：9.0 秒靜音、10.5 秒爆開、25 秒收尾）。每段的「表定開始」不變，轉場跨在交界的前後各一半
PLAN = [  # 名稱, 表定開始, 跟下一段的轉場, 轉場秒數
  ('01_intro', 0.0, 'fade', 0.4), ('02_couch', 3.0, 'zoomin', 0.6), ('03_peek', 6.0, 'fade', 0.3),
  ('04_blind', 9.0, 'fade', 0.2), ('05_guess', 10.5, 'fade', 0.3), ('06_twist', 13.5, 'fade', 0.3),
  ('07_replay', 16.0, 'fade', 0.6), ('08_couch', 19.0, 'zoomin', 0.6), ('09_solo', 22.0, 'fade', 0.5), ('10_end', 25.0, None, 0)]
END = 28.4
def span(i):
    s0 = PLAN[i][1] - (PLAN[i - 1][3] / 2 if i else 0)
    s1 = (PLAN[i + 1][1] + PLAN[i][3] / 2) if i + 1 < len(PLAN) else END
    return s0, s1 - s0, (PLAN[i - 1][3] / 2 if i else 0)
def seg(i, *a, **k):
    s0, dur, lead = span(i); return dur, lead
d, l = seg(0); finish(frames('intro', d), ANIM_VF, d, '01_intro')
d, l = seg(1); finish(['-ss', f'{0.4 - l:.2f}', '-i', f'{D}/couch.mp4'], COUCH_VF, d, '02_couch', CAPS['couch1'], 1380, (255, 160, 60), l)
d, l = seg(2); finish(['-loop', '1', '-i', f'{RAW}/{LANG}-peek.png'], STILL_VF, d, '03_peek', CAPS['peek'], 1320, (255, 90, 90), l)
d, l = seg(3); finish(frames('blind', d), GAME_VF, d, '04_blind', CAPS['blind'], 1250, (90, 90, 90), l)
d, l = seg(4); finish(frames('guess', d, start=0.8 - l, speed=1.0), GAME_VF, d, '05_guess', CAPS['guess'], 90, (255, 90, 90), l)
d, l = seg(5); finish(['-loop', '1', '-i', f'{RAW}/{LANG}-twist.png'], STILL_VF, d, '06_twist', CAPS['twist'], 1350, (255, 170, 40), l)
d, l = seg(6); finish(frames('replay', d, start=0.3, speed=1.05), GAME_VF, d, '07_replay', CAPS['replay'], 1500, (120, 120, 255), l)
d, l = seg(7); finish(['-ss', f'{4.8 - l:.2f}', '-i', f'{D}/couch.mp4'], COUCH_VF, d, '08_couch', CAPS['couch2'], 1450, (255, 90, 90), l)
d, l = seg(8); finish(frames('solo', d, start=0.5, speed=1.5), GAME_VF, d, '09_solo', CAPS['solo'], 1500, (60, 160, 255), l)
d, l = seg(9); finish(frames('end', d), ANIM_VF, d, '10_end')
# 用 xfade 串起來：第 i 段到第 i+1 段的轉場，從「表定開始 − 轉場一半」開始
inputs = []; [inputs.extend(['-i', s_]) for s_ in segs]
chain = ''; prev = '[0:v]'
for i in range(len(PLAN) - 1):
    name, st, tr, ov = PLAN[i]; off = PLAN[i + 1][1] - ov / 2
    out = f'[x{i}]' if i < len(PLAN) - 2 else '[vout]'
    chain += f"{prev}[{i + 1}:v]xfade=transition={tr}:duration={ov}:offset={off:.3f}{out};"; prev = out
run(['ffmpeg', '-y', *inputs, '-filter_complex', chain.rstrip(';'), '-map', '[vout]', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', f'{tmp}/video.mp4'])
# 接起來＋配樂（13～22 秒＋40～59.4 秒）
run(['ffmpeg', '-y', '-i', f'{D}/music.mp3', '-filter_complex',
     "[0:a]atrim=13:22,asetpts=PTS-STARTPTS,afade=t=out:st=8.94:d=0.06[a1];[0:a]atrim=40:59.4,asetpts=PTS-STARTPTS[a2];[a1][a2]concat=n=2:v=0:a=1,afade=t=in:d=0.3[a]",
     '-map', '[a]', f'{tmp}/music.m4a'])
run(['ffmpeg', '-y', '-i', f'{tmp}/video.mp4', '-i', f'{tmp}/music.m4a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', OUT])
print('built', OUT)
