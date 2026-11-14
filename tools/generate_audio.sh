#!/bin/zsh
# Generates natural macOS voice audio files (.m4a AAC) for all TOEFL Listening & Speaking prompts.
set -e

OUT="/Users/andy/Coding/TOEFLtyper/public/audio"
TMP="/tmp/toefltyper_tts"
mkdir -p "$OUT" "$TMP"

gen_single() {
  local id="$1"
  local voice="$2"
  local rate="$3"
  local text="$4"
  say -v "$voice" -r "$rate" -o "$OUT/${id}.m4a" --data-format=aac "$text"
  echo "Generated $OUT/${id}.m4a ($voice)"
}

# Listening Choose a Response
gen_single "l1-cr-1" "Samantha" 178 "Didn't you say the reserve reading room closes early on Thursdays?"
gen_single "l1-cr-2" "Daniel" 178 "Where should I leave these extra safety goggles now that the orientation session is over?"

# Listening Conversation (multi-speaker stitched with afconvert / say segments)
# Because afconvert can encode a single AIFF, we synthesize turns into raw PCM and concatenate them with a brief pause.
python3 - <<'PY'
import subprocess, wave, os, tempfile

out_dir = "/Users/andy/Coding/TOEFLtyper/public/audio"
tmp_dir = "/tmp/toefltyper_tts"

turns = [
    ("Samantha", 180, "Hi, Mr. Alvarez. Do you have a minute? I'm applying for the summer urban-planning fellowship with the city transit department, and the portal asks for a faculty endorsement form."),
    ("Tom (Enhanced)", 178, "Sure, come on in. That transit fellowship is a great program—two of our seniors worked on their bus-rapid-transit redesign last year. What's the trouble with the endorsement form?"),
    ("Samantha", 180, "Well, my academic advisor, Professor Lindqvist, is on research leave in Stockholm this semester, and her automated email reply says she has limited internet access until mid-March. The fellowship application closes on March first."),
    ("Tom (Enhanced)", 178, "Ah, I see. For municipal fellowships, the endorser doesn't strictly have to be your assigned departmental advisor. Any full-time faculty member who has taught you in an upper-level seminar and can evaluate your quantitative analysis skills is eligible."),
    ("Samantha", 182, "Really? That's a relief. I took Spatial Data Modeling with Dr. Okafor in the fall and got an A on my final corridor study."),
    ("Tom (Enhanced)", 178, "Dr. Okafor would be ideal—the transit agency specifically looks for G I S mapping experience. Send him a copy of your graded corridor project along with the portal link today so he has plenty of context."),
]

wav_files = []
for idx, (voice, rate, text) in enumerate(turns):
    aiff = os.path.join(tmp_dir, f"turn_{idx}.aiff")
    wav = os.path.join(tmp_dir, f"turn_{idx}.wav")
    subprocess.run(["say", "-v", voice, "-r", str(rate), "-o", aiff, text], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@22050", "-c", "1", aiff, wav], check=True)
    wav_files.append(wav)

combined_wav = os.path.join(tmp_dir, "l1-conv-1.wav")
with wave.open(combined_wav, "wb") as out_w:
    out_w.setnchannels(1)
    out_w.setsampwidth(2)
    out_w.setframerate(22050)
    silence = b"\x00\x00" * int(22050 * 0.45)
    for i, wf in enumerate(wav_files):
        with wave.open(wf, "rb") as in_w:
            out_w.writeframes(in_w.readframes(in_w.getnframes()))
        if i < len(wav_files) - 1:
            out_w.writeframes(silence)

subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", combined_wav, os.path.join(out_dir, "l1-conv-1.m4a")], check=True)
print("Generated l1-conv-1.m4a (multi-voice)")
PY

# Listening Announcement
gen_single "l1-ann-1" "Karen" 175 "Attention everyone using the Fine Arts Ceramics Studio this week: starting tomorrow at noon, we will be shutting down both electric kilns in Room 108 to replace their thermocouple sensors and recalibrate the digital controllers. This means the final bisque firing before the spring student exhibition will load tonight at eight o'clock sharp. Any greenware pieces that are still damp to the touch cannot go into tonight's load because trapped moisture can cause clay to shatter inside the kiln. If your work isn't bone-dry yet, please sign up on the clipboard by the glazing sink to use the high-fire gas kiln in the courtyard annex on Friday morning instead."

# Listening Academic Talk
gen_single "l1-talk-1" "Daniel" 172 "When a metropolitan road network approaches capacity, each additional driver entering the central business district imposes a disproportionate delay on everyone else on the road. In economics, we call this a negative congestion externality: the individual commuter pays for their own fuel and time, but not for the aggregate time lost by thousands of other motorists. For decades, municipal governments tried to solve traffic bottlenecks by widening highways. Yet empirical studies consistently confirm what transportation planners call induced demand—expanding road capacity lowers the time cost of driving, which attracts commuters away from rail transit and encourages longer suburban trips until congestion returns to its previous equilibrium. To address this, several global cities—including Stockholm, Singapore, and London—have implemented cordon congestion pricing. Under a variable cordon system, electronic gantries charge vehicles a fee to cross into the city center, with higher rates during peak morning and evening rush hours. When Stockholm introduced its permanent congestion charge after a seven-month trial, traffic volume across the cordon dropped by roughly twenty percent, and peak travel times fell by nearly a third. Crucially, dedicating the toll revenue directly to expanding commuter bus frequency made the policy politically durable, because drivers who switched modes immediately experienced faster, more reliable public transit."

# Speaking: Listen and Repeat
gen_single "s1-lr-1" "Samantha" 172 "Please leave your laboratory notebooks on the front bench before exiting."
gen_single "s1-lr-2" "Daniel" 172 "The archaeology department will host a guest lecture on radiocarbon dating this Thursday."
gen_single "s1-lr-3" "Karen" 172 "Although initial survey results appeared promising, the sample size was too small to draw definitive conclusions."
gen_single "s1-lr-4" "Tom (Enhanced)" 172 "Students who wish to audit an advanced seminar must obtain written permission from both the instructor and the academic dean."
gen_single "s1-lr-5" "Moira" 172 "By integrating satellite thermal imagery with ground-level moisture sensors, hydrologists can forecast regional drought severity weeks in advance."

# Speaking: Take an Interview
gen_single "s1-int-1" "Tom (Enhanced)" 176 "Thank you for speaking with me today. To start off, when you are preparing for a major exam or working on a complex assignment, what kind of environment helps you concentrate best, and why?"
gen_single "s1-int-2" "Tom (Enhanced)" 176 "Many university courses require collaborative group projects rather than individual papers. In your experience, what is the biggest advantage or challenge of working in a student team?"
gen_single "s1-int-3" "Tom (Enhanced)" 176 "Looking more broadly at higher education, some professors ban laptops and tablets during lectures, arguing that handwritten notes improve retention. Do you think universities should restrict digital devices in lecture halls?"

ls -lh "$OUT"
