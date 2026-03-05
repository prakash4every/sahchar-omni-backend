import streamlit as st
import requests
import time
from PIL import Image
import io
import base64
from audio_recorder_streamlit import audio_recorder

# अपने Render बैकएंड का URL
BACKEND_URL = "https://sahchar-omni-backend.onrender.com"

st.set_page_config(page_title="CSC अलीपुर मल्टीमीडिया AI", page_icon="🤖", layout="wide")

# सत्र स्टेट इनिशियलाइज़ करें
if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = []

# साइडबार नेविगेशन
st.sidebar.title("सुविधाएँ")
app_mode = st.sidebar.selectbox("चुनें", ["चैट", "इमेज जनरेशन", "वीडियो जनरेशन", "ऑडियो ट्रांसक्रिप्शन"])

# ==================== चैट सेक्शन ====================
if app_mode == "चैट":
    st.title("💬 CSC अलीपुर चैटबॉट")
    
    # पुराने मैसेज दिखाएँ
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
    
    # यूजर इनपुट (टेक्स्ट और वॉइस)
    col1, col2 = st.columns([5, 1])
    with col1:
        prompt = st.chat_input("अपना संदेश लिखें...")
    with col2:
        # वॉइस रिकॉर्डिंग बटन
        audio_bytes = audio_recorder(
            text="🎤",
            recording_color="#e74c3c",
            neutral_color="#6c757d",
            icon_size="2x"
        )
    
    if prompt:
        # यूजर मैसेज दिखाएँ
        with st.chat_message("user"):
            st.write(prompt)
        st.session_state.chat_messages.append({"role": "user", "content": prompt})
        
        # बैकएंड से रिस्पॉन्स लें
        with st.chat_message("assistant"):
            with st.spinner("सोच रहा हूँ..."):
                try:
                    response = requests.post(
                        f"{BACKEND_URL}/chat",
                        json={"message": prompt},
                        headers={"Content-Type": "application/json"}
                    )
                    if response.status_code == 200:
                        reply = response.json().get("reply", "कोई जवाब नहीं मिला")
                        st.write(reply)
                        st.session_state.chat_messages.append({"role": "assistant", "content": reply})
                    else:
                        st.error(f"एरर: {response.status_code}")
                except Exception as e:
                    st.error(f"बैकएंड से कनेक्ट नहीं हो सका: {e}")
    
    # वॉइस इनपुट प्रोसेसिंग
    if audio_bytes:
        st.audio(audio_bytes, format="audio/wav")
        with st.spinner("ऑडियो ट्रांसक्राइब हो रहा है..."):
            files = {"audio": ("recording.wav", audio_bytes, "audio/wav")}
            try:
                res = requests.post(f"{BACKEND_URL}/api/audio/transcribe", files=files)
                if res.status_code == 200:
                    transcript = res.json().get("transcription", "")
                    # अब इस ट्रांसक्रिप्ट को चैट में भेजें
                    with st.chat_message("user"):
                        st.write(transcript)
                    st.session_state.chat_messages.append({"role": "user", "content": transcript})
                    
                    # और फिर रिस्पॉन्स लें
                    with st.chat_message("assistant"):
                        response = requests.post(
                            f"{BACKEND_URL}/chat",
                            json={"message": transcript},
                            headers={"Content-Type": "application/json"}
                        )
                        if response.status_code == 200:
                            reply = response.json().get("reply", "")
                            st.write(reply)
                            st.session_state.chat_messages.append({"role": "assistant", "content": reply})
                else:
                    st.error("ट्रांसक्रिप्शन फेल")
            except Exception as e:
                st.error(f"एरर: {e}")

# ==================== इमेज जनरेशन ====================
elif app_mode == "इमेज जनरेशन":
    st.title("🖼️ AI इमेज जनरेटर")
    
    prompt = st.text_input("प्रॉम्प्ट दर्ज करें (अंग्रेज़ी में)", placeholder="उदाहरण: A beautiful sunset over mountains")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("इमेज बनाएँ", type="primary"):
            if prompt:
                with st.spinner("इमेज बन रही है..."):
                    try:
                        response = requests.post(
                            f"{BACKEND_URL}/api/image/generate",
                            json={"prompt": prompt, "language": "hi"}
                        )
                        if response.status_code == 200:
                            img_url = response.json().get("imageUrl")
                            st.image(img_url, caption=prompt, use_column_width=True)
                        else:
                            st.error(f"एरर: {response.status_code}")
                    except Exception as e:
                        st.error(f"बैकएंड से कनेक्ट नहीं हो सका: {e}")
            else:
                st.warning("कृपया प्रॉम्प्ट दर्ज करें")
    
    with col2:
        st.info("नोट: फिलहाल यह placeholder इमेज दिखा रहा है। असली इमेज जनरेशन के लिए बैकएंड को किसी API (जैसे Replicate) से जोड़ना होगा।")

# ==================== वीडियो जनरेशन ====================
elif app_mode == "वीडियो जनरेशन":
    st.title("🎥 AI वीडियो जनरेटर")
    
    prompt = st.text_input("वीडियो के लिए प्रॉम्प्ट दर्ज करें", placeholder="उदाहरण: A cat playing with a ball")
    duration = st.slider("वीडियो की अवधि (सेकंड)", 5, 30, 10)
    
    if st.button("वीडियो बनाएँ", type="primary"):
        if prompt:
            with st.spinner("वीडियो बन रहा है... (इसमें कुछ समय लग सकता है)"):
                try:
                    response = requests.post(
                        f"{BACKEND_URL}/api/video/generate",
                        json={"prompt": prompt, "duration": duration, "language": "hi"}
                    )
                    if response.status_code == 200:
                        video_url = response.json().get("videoUrl")
                        st.video(video_url)
                        st.success("वीडियो तैयार है!")
                    else:
                        st.error(f"एरर: {response.status_code}")
                except Exception as e:
                    st.error(f"बैकएंड से कनेक्ट नहीं हो सका: {e}")
        else:
            st.warning("कृपया प्रॉम्प्ट दर्ज करें")

# ==================== ऑडियो ट्रांसक्रिप्शन ====================
elif app_mode == "ऑडियो ट्रांसक्रिप्शन":
    st.title("🎤 ऑडियो ट्रांसक्रिप्शन")
    
    uploaded_file = st.file_uploader("ऑडियो फाइल अपलोड करें", type=["mp3", "wav", "m4a", "ogg"])
    
    if uploaded_file is not None:
        st.audio(uploaded_file, format=uploaded_file.type)
        
        if st.button("ट्रांसक्राइब करें", type="primary"):
            with st.spinner("ट्रांसक्राइब हो रहा है..."):
                files = {"audio": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                try:
                    res = requests.post(f"{BACKEND_URL}/api/audio/transcribe", files=files)
                    if res.status_code == 200:
                        transcription = res.json().get("transcription", "")
                        st.subheader("ट्रांसक्रिप्शन:")
                        st.write(transcription)
                        
                        # अगर चाहें तो चैट में भेजने का विकल्प
                        if st.button("इसे चैट में भेजें"):
                            # चैट सेक्शन में रीडायरेक्ट करने का कोड
                            st.session_state.chat_messages.append({"role": "user", "content": transcription})
                            st.success("चैट में भेज दिया गया! चैट सेक्शन पर जाएँ.")
                    else:
                        st.error(f"ट्रांसक्रिप्शन फेल: {res.status_code}")
                except Exception as e:
                    st.error(f"एरर: {e}")

# फुटर
st.sidebar.markdown("---")
st.sidebar.info("पावर्ड बाय DeepSeek AI और CSC अलीपुर")