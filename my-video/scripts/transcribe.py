"""Word-level transcription: python3 transcribe.py medium.en public/make-it-big.mp3 -> words_medium.en.json"""
import json, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", cpu_threads=4)
segs, info = m.transcribe(sys.argv[2], language="en", word_timestamps=True, vad_filter=False, beam_size=5, initial_prompt="Rap song 'Make It Big'. Stack the guap till we living on a mountain top. God's the plot.")
out=[]
for s in segs:
    out.append({"start":s.start,"end":s.end,"text":s.text,"words":[{"w":w.word,"s":w.start,"e":w.end,"p":w.probability} for w in s.words]})
    print(f"{s.start:7.2f} {s.end:7.2f} {s.text}", flush=True)
json.dump(out, open(f"words_{sys.argv[1]}.json","w"), indent=1)
