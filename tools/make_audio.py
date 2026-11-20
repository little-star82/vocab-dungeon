#!/usr/bin/env python3
"""幫一座關卡島產生發音檔（Kokoro-82M 的 af_heart 女聲，跟 Week 11 同一個聲音）。

用法（在專案根目錄）：
  uv run --python 3.12 --with kokoro-onnx --with soundfile tools/make_audio.py w08

做的事：
  1. 讀 islands/<島>/island.js，列出遊戲會唸的每一段文字
     （單字、片語、例句、手寫片語題的 say）
  2. 已經有發音檔的跳過，只補缺的
  3. 單字和短片語語速 0.85、整句 0.9，轉成 24kHz 單聲道 48kbps 的 mp3 放進 audio/
  4. 把「文字 → 檔名」寫進 islands/<島>/audio.js

island.js 要這樣接上（只需要做一次）：
  import audio from './audio.js';
  export default { ..., audio, ... };

需要：node、ffmpeg、uv。模型放在 ~/.cache/hyperframes/tts/（跟 HyperFrames 共用），沒有會自動下載，約 340MB。
"""
import json, os, re, subprocess, sys, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path.home() / ".cache" / "hyperframes" / "tts"
MODEL, VOICES = CACHE / "models" / "kokoro-v1.0.onnx", CACHE / "voices" / "voices-v1.0.bin"
RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
VOICE, WORD_SPEED, SENTENCE_SPEED = "af_heart", 0.85, 0.9

# 跟 js/game.js 的 sayOf、phTokens、phSentences 同一套規則：遊戲唸什麼字，這裡就產什麼字
DUMP = r"""
const isl=(await import(process.argv[1])).default;
const sayOf=w=>w.say||w.en.replace(/\(s\)/g,'s').replace(/\([^)]*\)/g,' ').replace(/\s*\/\s*/g,', ').replace(/…/g,' ').replace(/\s+/g,' ').trim();
const norm=t=>t.replace(/sb\./g,'somebody').replace(/sth\./g,'something').replace(/…/g,'').trim();
const out=[], add=(key,sentence)=>{ if(key&&!out.some(x=>x.key===key)) out.push({key,sentence}); };
for(const w of isl.words||[]) add(sayOf(w),false);
const tokens=p=>p.en.replace(/\([^)]*\)/g,' ').replace(/…/g,' ').split(/\s+/).filter(Boolean);
const sentences=p=>p.sents||(p.ex||'').replace(/\b(Mr|Mrs|Ms|Dr|O\.K|a\.m|p\.m)\./g,'$1\u0001').replace(/(^|[.!?]\s+)[A-Z][A-Za-z]*:\s*/g,'$1')
  .split(/(?<=[.!?])\s+/).map(x=>x.replace(/\u0001/g,'.').trim()).filter(x=>x.split(' ').length>=4);
for(const p of isl.phrases||[]){
  add(norm(tokens(p).join(' ')),false);
  if(p.ex) add(p.ex,true);
  for(const s of sentences(p)) add(s,true);
}
for(const q of isl.bossQ||[]) if(q.say) add(norm(q.say),q.say.split(' ').length>3);
let have={}; try{ have=(await import(process.argv[2])).default; }catch(e){ have=isl.audio||{}; }
console.log(JSON.stringify({items:out,have}));
"""

def speakable(key):   # 送進語音模型前，把縮寫換成唸得出來的字
    return key.replace("sb's", "somebody's").replace("sb.", "somebody").replace("sth.", "something").replace("…", " ").strip()

def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    isl = sys.argv[1]
    folder = ROOT / "islands" / isl
    if not (folder / "island.js").exists():
        sys.exit(f"找不到 {folder / 'island.js'}")
    if not (folder / "audio.js").exists():   # 第一次跑：先放一個空的對照表，island.js 才讀得進來
        (folder / "audio.js").write_text("export default {};\n", encoding="utf-8")
    data = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", DUMP, f"./islands/{isl}/island.js", f"./islands/{isl}/audio.js"], cwd=ROOT))
    needed = {x["key"] for x in data["items"]}
    have = {k: v for k, v in data["have"].items() if k in needed}   # 單字改掉之後，用不到的對照就拿掉（mp3 檔不會刪）
    todo = [x for x in data["items"] if x["key"] not in have]
    print(f"{isl}：共 {len(data['items'])} 段文字，已有 {len(data['items']) - len(todo)} 段，要產生 {len(todo)} 段")
    if todo:
        for path, name in ((MODEL, "kokoro-v1.0.onnx"), (VOICES, "voices-v1.0.bin")):
            if not path.exists():
                print(f"下載模型 {name} …"); path.parent.mkdir(parents=True, exist_ok=True)
                urllib.request.urlretrieve(RELEASE + name, path)
        import soundfile as sf
        from kokoro_onnx import Kokoro
        tts = Kokoro(str(MODEL), str(VOICES))
        out_dir = folder / "audio"; out_dir.mkdir(exist_ok=True)
        used = [int(m.group(1)) for f in list(have.values()) + [p.name for p in out_dir.glob("a*.mp3")] if (m := re.fullmatch(r"a(\d+)\.mp3", f))]
        n = max(used, default=-1) + 1
        with tempfile.TemporaryDirectory() as tmp:
            for item in todo:
                name, wav = f"a{n:03d}.mp3", os.path.join(tmp, "x.wav"); n += 1
                samples, sr = tts.create(speakable(item["key"]), voice=VOICE, speed=SENTENCE_SPEED if item["sentence"] else WORD_SPEED, lang="en-us")
                sf.write(wav, samples, sr)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", "24000", "-b:a", "48k", str(out_dir / name)], check=True)
                have[item["key"]] = name
                print(f"  {name}  {item['key']}")
    body = ",\n".join(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v)}" for k, v in have.items())
    (folder / "audio.js").write_text(
        "// 發音檔對照表：文字 → audio/ 裡的檔名。由 tools/make_audio.py 產生，不要手改。\n"
        "// 聲音：Kokoro-82M 的 af_heart（單字語速 0.85、整句 0.9）\n"
        f"export default {{\n{body},\n}};\n", encoding="utf-8")
    print(f"寫好 islands/{isl}/audio.js（{len(have)} 筆）")
    if "./audio.js" not in (folder / "island.js").read_text(encoding="utf-8"):
        print("提醒：island.js 還沒有 import audio from './audio.js'，記得接上。")

if __name__ == "__main__":
    main()
