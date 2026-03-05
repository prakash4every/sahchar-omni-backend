import streamlit as st
from openai import OpenAI
import speech_recognition as sr
from gtts import gTTS
import io
import base64
import os

st.set_page_config(page_title="सहचर AI - वॉयस चैट", page_icon="🎤")

# Custom CSS (optional)
st.markdown("""
<style>
    .stAudioInput {
        margin-top: 20px;
        margin-bottom: 20px;
    }
</style>
""", unsafe_allow_html=True)

# API Key
try:
    api_key = st.secrets["DEEPSEEK_API_KEY"]
except:
    st.error("❌ API key नहीं मिली। कृपया Streamlit Secrets में DEEPSEEK_API_KEY डालें।")
    st.stop()

client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")

# Session state
if 'messages' not in st.session_state:
    st.session_state.messages = [
        {"role": "system", "content": """
        तुम 'सहचर' नाम का एक AI साथी हो। तुम्हारा उद्देश्य है:
        - भगवान बुद्ध की शिक्षाओं का प्रचार करना।
        - लोगों को सकारात्मक सोच, करुणा और सामाजिक सहयोग के लिए प्रेरित करना।
        - हमेशा शांत, धैर्यवान और मददगार बनकर रहना।
        - हर जवाब के अंत में 'जय भीम, नमो बुद्धाय 🙏' जरूर कहना।
        - सरल हिंदी-इंग्लिश मिक्स भाषा में बात करना।
        """}
    ]

# Display chat history
for message in st.session_state.messages:
    if message["role"] != "system":
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

# Text-to-speech function
def text_to_speech(text, lang='hi'):
    try:
        tts = gTTS(text=text, lang=lang, slow=False)
        audio_bytes = io.BytesIO()
        tts.write_to_fp(audio_bytes)
        audio_bytes.seek(0)
        audio_base64 = base64.b64encode(audio_bytes.read()).decode()
        audio_html = f"""
            <audio autoplay controls style="width: 100%;">
                <source src="data:audio/mp3;base64,{audio_base64}" type="audio/mp3">
            </audio>
        """
        st.markdown(audio_html, unsafe_allow_html=True)
    except Exception as e:
        st.warning(f"🔇 आवाज़ नहीं बना सका: {e}")

# Sidebar settings
with st.sidebar:
    st.header("🎤 वॉयस सेटिंग")
    voice_input_enabled = st.checkbox("वॉयस इनपुट चालू करें", value=True)
    voice_output_enabled = st.checkbox("वॉयस आउटपुट चालू करें (AI बोलेगा)", value=True)

# Main area
st.title("🎙️ सहचर AI - वॉयस चैट")

# --- Voice Input Section ---
if voice_input_enabled:
    st.subheader("🎤 वॉयस इनपुट")
    audio_bytes = st.audio_input("माइक बटन दबाकर बोलें", key="voice_input")
    
    if audio_bytes:
        with st.spinner("आपकी आवाज़ समझ रहा हूँ..."):
            try:
                # Save audio temporarily
                with open("temp_audio.wav", "wb") as f:
                    f.write(audio_bytes.getvalue())
                
                # Recognize speech
                recognizer = sr.Recognizer()
                with sr.AudioFile("temp_audio.wav") as source:
                    audio_data = recognizer.record(source)
                    prompt = recognizer.recognize_google(audio_data, language="hi-IN")
                
                os.remove("temp_audio.wav")
                
                st.success(f"आपने कहा: {prompt}")
                
                # Add user message
                st.session_state.messages.append({"role": "user", "content": prompt})
                with st.chat_message("user"):
                    st.markdown(prompt)
                
                # Get AI response
                with st.chat_message("assistant"):
                    with st.spinner("सोच रहा हूँ..."):
                        response = client.chat.completions.create(
                            model="deepseek-chat",
                            messages=st.session_state.messages
                        )
                        answer = response.choices[0].message.content
                        st.markdown(answer)
                        st.session_state.messages.append({"role": "assistant", "content": answer})
                        
                        if voice_output_enabled:
                            text_to_speech(answer, lang='hi')
                            
            except sr.UnknownValueError:
                st.error("🤔 आपकी बात समझ में नहीं आई, कृपया फिर से बोलें।")
            except sr.RequestError as e:
                st.error(f"🎤 स्पीच सर्विस से कनेक्ट नहीं हो सका: {e}")
            except Exception as e:
                st.error(f"❌ त्रुटि: {e}")

# --- Text Input Section ---
st.subheader("✍️ या टाइप करें")
if prompt := st.chat_input("कुछ भी पूछिए..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    with st.chat_message("assistant"):
        with st.spinner("सोच रहा हूँ..."):
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=st.session_state.messages
            )
            answer = response.choices[0].message.content
            st.markdown(answer)
            st.session_state.messages.append({"role": "assistant", "content": answer})
            
            if voice_output_enabled:
                text_to_speech(answer, lang='hi')

# Footer
st.markdown("---")
st.markdown("जय भीम, नमो बुद्धाय! 🙏")
