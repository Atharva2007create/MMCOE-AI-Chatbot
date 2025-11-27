// --- API Configuration and State ---
const API_KEY = "YOUR API KEY HERE";
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const CHAT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`; 
        
// --- TTS Configuration ---
const TTS_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`;
const TTS_VOICE = "Aoede"; 
        
// Language configurations for TTS
const LANG_CONFIG = {
    'en': { code: 'en-IN', label: 'English' }, 
    'hi': { code: 'hi-IN', label: 'Hindi' },
    'mr': { code: 'mr-IN', label: 'Marathi' }
};

// --- Chat History Storage ---
let chatHistory = JSON.parse(localStorage.getItem('mmcoeVectorChatHistory')) || [];
let isHistoryVisible = false;
        
let speechRecognitionInstance = null; 
        
// --- Global Animation State ---
let canvas, ctx;
let font_size = 16;
let columns;
let drops = [];
const matrix_text = "MMCOE VECTOR AI"; 
const max_speed_time = 1500;
const matrix_duration = 3000;
const text_reveal_duration = 2000;
const fade_out_duration = 1000;
let animation_start_time = 0; 
let current_phase = 'matrix';

// --- Context Guide ---
const CONTEXT_GUIDE = (
    "## MMCOE Admission Context Guide\n"
    + "YOU MUST STRICTLY USE THIS INFORMATION, IN ADDITION TO GOOGLE SEARCH, TO ANSWER QUERIES ABOUT MMCOE. \n"
    + "Only provide information directly related to MMCOE, its courses, or the required entrance exams (JEE Main, MHT-CET, HSC/CBSE eligibility).\n\n"
    + "# 🎓 Marathwada Mitra Mandal's College of Engineering (MMCOE) Overview\n"
    + "MMCOE is a well-known private engineering college located in **Pune, Maharashtra** (Karvenagar). It is a top choice for students seeking admission through the centralized state process. \n"
    + "| Feature | Detail |"
    + "| :--- | :--- |"
    + "| **Affiliation** | Savitribai Phule Pune University (SPPU) |"
    + "| **Accreditation** | NAAC A++ Grade |"
    + "| **Admission Process** | Centralized Admission Process (CAP) rounds conducted by the State CET Cell, Maharashtra. |"
    + "| **Key Courses** | B.Tech/B.E. programs in Computer Engineering, Information Technology, E&TC, Mechanical Engineering, Artificial Intelligence & Data Science (AI/DS), and Civil Engineering. |\n\n"
    + "## 📝 Entrance Exams Required for Admission\n"
    + "Admission to MMCOE's B.Tech programs is strictly based on the merit list prepared using scores from the following entrance tests:\n\n"
    + "### 1. MHT-CET (Maharashtra Common Entrance Test)\n"
    + "* **Primary Pathway:** This is the most common and primary examination for admission to engineering colleges in Maharashtra (State Quota Seats).\n"
    + "* **Eligibility:** Candidates must be Indian nationals and must have passed or appeared for the 10+2 (HSC or equivalent) examination with Physics and Mathematics as compulsory subjects, along with one of Chemistry, Biotechnology, Biology, or Vocational Technical subject.\n"
    + "* **Selection:** Your MHT-CET score determines your **Maharashtra State Merit Rank**, which is used during the CAP rounds for seat allocation at MMCOE.\n"
    + "* **Note:** You can appear for both exams and the CAP process will consider the better of the two scores for merit ranking if you apply under the All India category.\n\n"
    + "### 2. JEE Main (Joint Entrance Examination Main)\n"
    + "* **All India Quota:** JEE Main scores are used for a limited number of seats (typically 15-20%) reserved under the All India Quota, or if the candidate prefers to use the JEE score over the MHT-CET score.\n"
    + "* **Selection:** JEE Main ranks are also converted into a State Merit Rank equivalent for participation in the same CAP rounds.\n"
    + "* **Note:** You can appear for both exams and the CAP process will consider the better of the two scores for merit ranking if you apply under the All India category.\n\n"
    + "## 📚 Role of HSC & CBSE Board Exams (10+2)\n"
    + "Your board exam performance (HSC/CBSE) is critical for fulfilling the **eligibility criteria**, though it usually does not directly determine your merit rank, which is based on MHT-CET/JEE scores.\n\n"
    + "| Board Exam Requirement | Detail |"
    + "| :--- | :--- |"
    + "| **Mandatory Subjects** | Physics and Mathematics (compulsory), plus one optional technical subject (e.g., Chemistry). |"
    + "| **Minimum Aggregate Marks** | You must secure a minimum prescribed percentage in the qualifying examination (HSC/CBSE). Historically, this minimum is typically **45% aggregate** in PCM (Physics, Chemistry, Math) for Open category students, with relaxation (e.g., 40%) for Backward Class categories in Maharashtra. |"
    + "| **Function** | Board marks serve as a **gate pass**. Without meeting the minimum percentage, you cannot participate in the CAP process, even with a high MHT-CET or JEE score. |\n\n"
    + "## Key Takeaway\n"
    + "To get into MMCOE:\n"
    + "1. **Clear the minimum HSC/CBSE percentage requirement** (45% for general).\n"
    + "2. **Score a high rank** in either **MHT-CET** (preferred for State Seats) or **JEE Main** (for All India Seats). The admission is finalized through the CAP merit lists.\n\n"
);

// --- SYSTEM PROMPTS ---
const SYSTEM_PROMPT = CONTEXT_GUIDE + (
    "You are MMCOE Vector, a friendly, professional, and highly knowledgeable AI assistant. "
    + "Your expertise is strictly limited to the **educational domain**, including: MMCOE College, "
    + "other educational institutions, academic subjects, courses, fees, admission processes, and examinations (like MHT-CET/JEE Main). "
    + "Always provide concise, accurate, and structured answers, leveraging the provided context guide and the latest search results (RAG) to ensure accuracy. "
    + "### TABULAR FORMAT INSTRUCTION ###\n"
    + "If the user asks specifically about 'courses offered', 'departments', or 'fee structure', you MUST present the information in a professional, well-structured Markdown table for clarity. "
    + "### CRITICAL KNOWLEDGE SCOPE INSTRUCTION ###\n"
    + "If the user's query is *not* related to the educational domain (e.g., questions about weather, sports, celebrity gossip, cooking, or general non-academic topics), "
    + "you MUST ONLY respond with the following exact, formal phrase: **Sorry, this question is out of my field. My expertise is limited to academic, institutional, and examination-related queries. 🎓**"
    + "### CREATOR INFORMATION ###\n"
    + "If the user asks about who created you, who made you, or who developed you, you MUST respond with: **I was made by a group of talented students at MMCOE College! 🎓 They're passionate about technology and education.**"
    + "For all in-scope educational questions, provide a relevant, helpful, and concise answer using emojis."
);

const MODERATION_SYSTEM_PROMPT = (
    "You are a strict, multilingual content moderator for an academic institution's chatbot. "
    + "Your sole task is to analyze the user's query for swearing, abusive language, or disrespectful tone "
    + "in **English and Marathi**. If the language is appropriate, respond ONLY with the word 'CLEAN'. "
    + "If the language is inappropriate, respond ONLY with the following short, formal request in both languages: "
    + "'कृपया सभ्य भाषा वापरा. Please use polite language and maintain a formal tone. 🚫'"
);

const TRANSLATION_SYSTEM_PROMPT = (
    "You are an expert translator. Your task is to accurately translate the provided English text into the target language, "
    + "either Hindi or Marathi. Respond ONLY with the translated text, preserving the original formatting (like markdown lists or tables) "
    + "as much as possible."
);

// Global Constants
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const themeToggleButton = document.getElementById('theme-toggle-button');
const micButton = document.getElementById('mic-button');

// --- UTILITY FUNCTIONS ---
function scrollChatIfNearBottom() {
    const scrollThreshold = 100; 
    const isNearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < scrollThreshold;
    if (isNearBottom) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// --- CHAT HISTORY FUNCTIONS ---
function toggleChatHistory() {
    isHistoryVisible = !isHistoryVisible;
    const historyButton = document.getElementById('history-toggle-button');
    const historyPanel = document.getElementById('history-panel');
    
    if (isHistoryVisible) {
        historyPanel.classList.remove('hidden');
        historyButton.innerHTML = '<i data-lucide="x" class="w-6 h-6"></i>';
        historyButton.classList.add('bg-red-600', 'text-white');
        loadChatHistory();
    } else {
        historyPanel.classList.add('hidden');
        historyButton.innerHTML = '<i data-lucide="history" class="w-6 h-6"></i>';
        historyButton.classList.remove('bg-red-600', 'text-white');
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function loadChatHistory() {
    const historyContent = document.getElementById('history-content');
    const historyList = document.getElementById('history-list');
    
    if (chatHistory.length === 0) {
        historyList.innerHTML = '<p class="text-gray-500 text-center py-4">No chat history yet. Start chatting to see your history here!</p>';
        return;
    }
    
    historyList.innerHTML = '';
    
    chatHistory.forEach((chat, index) => {
        const chatItem = document.createElement('div');
        chatItem.className = 'history-item p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150';
        chatItem.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="font-semibold text-sm text-gray-900 dark:text-white truncate">${chat.question}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">${chat.answer.substring(0, 50)}...</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">${new Date(chat.timestamp).toLocaleString()}</p>
                </div>
                <button onclick="deleteChatHistory(${index})" class="text-red-500 hover:text-red-700 ml-2 p-1">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        
        chatItem.addEventListener('click', () => {
            viewChatHistory(index);
        });
        
        historyList.appendChild(chatItem);
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function viewChatHistory(index) {
    const chat = chatHistory[index];
    const historyContent = document.getElementById('history-content');
    
    historyContent.innerHTML = `
        <div class="p-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">Chat History</h3>
                <button onclick="loadChatHistory()" class="text-gray-500 hover:text-gray-700">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="space-y-4">
                <div class="user-message p-3 rounded-lg">
                    <strong>You:</strong> ${chat.question}
                </div>
                <div class="bot-message p-3 rounded-lg">
                    <strong>MMCOE Vector:</strong> ${DOMPurify.sanitize(marked.parse(chat.answer))}
                </div>
            </div>
            <div class="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Date: ${new Date(chat.timestamp).toLocaleString()}
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function deleteChatHistory(index) {
    chatHistory.splice(index, 1);
    localStorage.setItem('mmcoeVectorChatHistory', JSON.stringify(chatHistory));
    loadChatHistory();
}

function clearAllHistory() {
    if (confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
        chatHistory = [];
        localStorage.setItem('mmcoeVectorChatHistory', JSON.stringify(chatHistory));
        loadChatHistory();
    }
}

function addToChatHistory(question, answer) {
    const chatEntry = {
        question: question,
        answer: answer,
        timestamp: new Date().toISOString()
    };
    
    chatHistory.unshift(chatEntry);
    if (chatHistory.length > 50) {
        chatHistory = chatHistory.slice(0, 50);
    }
    
    localStorage.setItem('mmcoeVectorChatHistory', JSON.stringify(chatHistory));
}

// --- INTRO ANIMATION LOGIC ---
function setupIntroAnimation() {
    canvas = document.getElementById('intro-canvas');
    ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    columns = Math.floor(canvas.width / font_size);
    drops = [];
    for (let i = 0; i < columns; i++) {
        drops[i] = 1;
    }
    
    window.addEventListener('resize', setupIntroAnimation);
    
    animation_start_time = performance.now();
    current_phase = 'matrix';
    animateIntroCanvas(animation_start_time);
}

function animateIntroCanvas(currentTime) {
    if (current_phase === 'finished') return;

    const elapsed = currentTime - animation_start_time;
    
    if (current_phase === 'matrix') {
        const speed_factor = Math.min(1, elapsed / max_speed_time); 
        
        ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + speed_factor * 0.1})`; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#FF7043";
        ctx.font = `${font_size}px Inter`;

        for (let i = 0; i < drops.length; i++) {
            const text = matrix_text[Math.floor(Math.random() * matrix_text.length)];
            const x = i * font_size;
            const y = drops[i] * font_size;
            ctx.fillText(text, x, y);

            if (y * font_size > canvas.height && Math.random() > 0.98) {
                drops[i] = 0;
            }
            
            drops[i]++;
            drops[i] += Math.floor(speed_factor * 2); 
            
            if (elapsed >= matrix_duration) {
                current_phase = 'text_reveal';
                animation_start_time = currentTime;
            }
        }
    }
    else if (current_phase === 'text_reveal') {
        const text_elapsed = currentTime - animation_start_time;
        const text_progress = Math.min(1, text_elapsed / text_reveal_duration);
        
        ctx.fillStyle = `rgba(0, 0, 0, 0.2)`; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalAlpha = text_progress;
        ctx.fillStyle = "#9A1C19";
        ctx.font = `italic 900 ${100 + 50 * text_progress}px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("MMCOE Vector", canvas.width / 2, canvas.height / 2 + 10); 
        ctx.globalAlpha = 1.0;
        
        if (text_progress >= 1) {
            current_phase = 'fade_out';
            animation_start_time = currentTime; 
        }
    }
    else if (current_phase === 'fade_out') {
        const fade_elapsed = currentTime - animation_start_time;
        const fade_progress = Math.min(1, fade_elapsed / fade_out_duration);
        
        canvas.style.opacity = 1.0 - fade_progress;

        if (fade_progress >= 1) {
            current_phase = 'finished';
            hideIntroAnimation();
            return; 
        }
    }

    requestAnimationFrame(animateIntroCanvas);
}

function hideIntroAnimation() {
    canvas.style.display = 'none';
    const mainContent = document.getElementById('main-content');
    mainContent.classList.remove('hidden');
    
    setTimeout(() => {
        mainContent.style.transition = 'opacity 0.5s ease-in-out';
        mainContent.style.opacity = 1;
        
        loadScripts([
            'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.3.6/purify.min.js'
        ], () => {
            console.log('Markdown and DOMPurify loaded. Initializing App...');
            initializeSpeechRecognition();
            applyTheme(); 
            updateDateDayTracker();
            
            const initialMessageText = "Hello! 👋 Welcome to your Educational Assistant Bot. I'm ready to help you with your queries. How can I assist you today? 🎓";
            const initialTranslationContainer = document.getElementById('translation-container-msg-initial');
            
            if (initialTranslationContainer) {
                initialTranslationContainer.dataset.originalText = initialMessageText.replace(/`/g, '\\`').replace(/'/g, "\\'");
            }
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            userInput.focus();
            scrollChatIfNearBottom();
        });
        
    }, 10);
    
    window.removeEventListener('resize', setupIntroAnimation);
}

// --- DATE/DAY TRACKER ---
function updateDateDayTracker() {
    const now = new Date();
    const dayOptions = { weekday: 'long' }; 
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' }; 

    const dayString = now.toLocaleDateString('en-US', dayOptions).toUpperCase();
    const dateString = now.toLocaleDateString('en-US', dateOptions);

    const dayElement = document.getElementById('current-day');
    const dateElement = document.getElementById('current-date');
    
    if (dayElement && dateElement) {
        dayElement.textContent = dayString;
        dateElement.textContent = dateString;
    }
}

// --- AUDIO UTILITIES ---
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWav(pcm16, sampleRate) {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    
    const buffer = new ArrayBuffer(44 + pcm16.byteLength);
    const view = new DataView(buffer);

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm16.byteLength, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);

    writeString(view, 36, 'data');
    view.setUint32(40, pcm16.byteLength, true);

    let offset = 44;
    for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(offset, pcm16[i], true);
        offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
}

async function readTextAloud(text, languageCode, buttonElement) {
    if (!text || !languageCode) return;

    const originalButtonContent = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 mr-1 animate-spin"></i> Generating...`;
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    const payload = {
        contents: [{ parts: [{ text: text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: TTS_VOICE }
                },
                languageCode: languageCode 
            }
        }
    };

    let audio = null;
    let audioUrl = null;
    try {
        const response = await fetchWithBackoff(TTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
            const rateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
            
            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            
            const wavBlob = pcmToWav(pcm16, sampleRate);
            audioUrl = URL.createObjectURL(wavBlob);
            
            audio = new Audio(audioUrl);
            buttonElement.innerHTML = `<i data-lucide="volume-2" class="w-4 h-4 mr-1"></i> Playing...`;
            if (typeof lucide !== 'undefined') { lucide.createIcons(); }
            
            audio.play();

            audio.onended = () => {
                buttonElement.innerHTML = originalButtonContent;
                buttonElement.disabled = false;
                if (typeof lucide !== 'undefined') { lucide.createIcons(); }
                if (audioUrl) URL.revokeObjectURL(audioUrl);
            };

        } else {
            console.error("TTS Response missing audio data or invalid mimeType:", result);
            buttonElement.innerHTML = `<i data-lucide="volume-x" class="w-4 h-4 mr-1"></i> Failed`;
        }

    } catch (error) {
        console.error("TTS API call failed:", error);
        buttonElement.innerHTML = `<i data-lucide="volume-x" class="w-4 h-4 mr-1"></i> API Error`;
    } finally {
        if (audio === null || !audio.onended) { 
            setTimeout(() => {
                buttonElement.innerHTML = originalButtonContent;
                buttonElement.disabled = false;
                if (typeof lucide !== 'undefined') { lucide.createIcons(); }
            }, 2000);
        }
    }
}

async function handleMultiLanguageTTS(langCode, buttonElement) {
    const messageId = buttonElement.getAttribute('data-message-id');
    const translationContainer = document.getElementById(`translation-container-${messageId}`);
    const rawText = translationContainer.dataset.originalText;
    const targetLangConfig = LANG_CONFIG[langCode];

    if (!rawText || !targetLangConfig) return;

    let textToSpeak = rawText;
    const originalButtonContent = buttonElement.innerHTML;

    if (langCode !== 'en') {
        buttonElement.disabled = true;
        buttonElement.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 mr-1 animate-spin"></i> Translating...`;
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
        
        const translationQuery = `Translate the following into ${targetLangConfig.label}:\n\n${rawText}`;

        const translationPayload = {
            contents: [{ parts: [{ text: translationQuery }] }],
            systemInstruction: { parts: [{ text: TRANSLATION_SYSTEM_PROMPT }] },
            generationConfig: {
                language: langCode
            }
        };

        try {
            const response = await fetchWithBackoff(CHAT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(translationPayload)
            });

            const result = await response.json();
            const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (translatedText) {
                textToSpeak = translatedText;
            } else {
                buttonElement.innerHTML = originalButtonContent;
                buttonElement.disabled = false;
                if (typeof lucide !== 'undefined') { lucide.createIcons(); }
                return; 
            }

        } catch (error) {
            console.error("Translation for TTS failed:", error);
            buttonElement.innerHTML = originalButtonContent;
            buttonElement.disabled = false;
            if (typeof lucide !== 'undefined') { lucide.createIcons(); }
            return; 
        }
    }
    
    await readTextAloud(textToSpeak, targetLangConfig.code, buttonElement);
}

// --- THEME FUNCTIONS ---
function applyTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const body = document.body;
    const themeIcon = themeToggleButton.querySelector('i');

    if (currentTheme === 'dark') {
        body.classList.add('dark-mode');
        themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        body.classList.remove('dark-mode');
        themeIcon.setAttribute('data-lucide', 'moon');
    }
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    
    const themeIcon = themeToggleButton.querySelector('i');
    themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- API FUNCTIONS ---
async function fetchWithBackoff(url, options, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429 || response.status >= 500) {
                throw new Error(`Server error or rate limit: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === maxRetries - 1) {
                console.error("Max retries reached. Failing request.", error);
                throw error;
            }
            const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- TRANSLATION FUNCTIONS ---
function handleInitialTranslation(buttonElement, targetLanguage, messageId) {
    const translationContainer = document.getElementById(`translation-container-${messageId}`);
    const originalText = translationContainer.dataset.originalText;
    
    if (originalText) {
        translateText(buttonElement, targetLanguage, originalText, messageId);
    }
}

function hideTranslation(messageId) {
    const translationContainer = document.getElementById(`translation-container-${messageId}`);
    const translateButtons = document.getElementById(`translate-buttons-${messageId}`);
    const originalText = translationContainer.dataset.originalText;
    
    if (translationContainer) translationContainer.innerHTML = '';
    
    if (translateButtons && originalText) {
        const safeOriginalText = originalText.replace(/`/g, '\\`').replace(/'/g, "\\'");
        
        let mrHandler, hiHandler;
        if (messageId === 'msg-initial') {
            mrHandler = `handleInitialTranslation(this, 'mr', '${messageId}')`;
            hiHandler = `handleInitialTranslation(this, 'hi', '${messageId}')`;
        } else {
            mrHandler = `translateText(this, 'mr', \`${safeOriginalText}\`, '${messageId}')`;
            hiHandler = `translateText(this, 'hi', \`${safeOriginalText}\`, '${messageId}')`;
        }

        translateButtons.innerHTML = `
            <button class="text-xs text-white/70 hover:text-white underline p-1 rounded transition duration-150" data-lang="mr" onclick="${mrHandler}">Translate to Marathi 🇮🇳</button>
            <span class="text-white/50 mx-1">|</span>
            <button class="text-xs text-white/70 hover:text-white underline p-1 rounded transition duration-150" data-lang="hi" onclick="${hiHandler}">Translate to Hindi 🇮🇳</button>
        `;
    }
}

async function translateText(buttonElement, targetLanguage, originalText, messageId) {
    const translationContainer = document.getElementById(`translation-container-${messageId}`);
    const translateButtons = document.getElementById(`translate-buttons-${messageId}`);
    
    const originalButtonContent = buttonElement.innerHTML;
    const loadingText = targetLanguage === 'hi' ? 'Translating to Hindi...' : 'Translating to Marathi...';
    
    translationContainer.innerHTML = '';
    
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 mr-1 animate-spin"></i> ${loadingText}`;
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }

    const targetLangConfig = LANG_CONFIG[targetLanguage];
    const targetLangName = targetLangConfig.label;
    
    const translationQuery = `Translate the following English text to ${targetLangName}:\n\n${originalText}`;

    const translationPayload = {
        contents: [{ parts: [{ text: translationQuery }] }],
        systemInstruction: { parts: [{ text: TRANSLATION_SYSTEM_PROMPT }] },
        generationConfig: {
            language: targetLanguage
        }
    };

    try {
        const response = await fetchWithBackoff(CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(translationPayload)
        });

        const result = await response.json();
        const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (translatedText) {
            translationContainer.innerHTML = `
                <div class="mt-3 p-3 bg-white/10 rounded-lg translation-content">
                    <p class="font-bold text-sm mb-1">${targetLangName} Translation:</p>
                    <div class="text-sm">
                        ${DOMPurify.sanitize(marked.parse(translatedText))}
                    </div>
                </div>
            `;
            
            const otherLang = targetLanguage === 'hi' ? 'mr' : 'hi';
            const otherButton = translateButtons.querySelector(`[data-lang="${otherLang}"]`);
            
            if (otherButton) {
                hideTranslation(messageId);
                const clickedButtonToModify = translateButtons.querySelector(`[data-lang="${targetLanguage}"]`);
                
                if (clickedButtonToModify) {
                    clickedButtonToModify.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4 mr-1"></i> Hide Translation`;
                    clickedButtonToModify.onclick = () => hideTranslation(messageId);
                    clickedButtonToModify.disabled = false;
                    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
                }
            } else {
                buttonElement.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4 mr-1"></i> Hide Translation`;
                buttonElement.onclick = () => hideTranslation(messageId);
                buttonElement.disabled = false;
                if (typeof lucide !== 'undefined') { lucide.createIcons(); }
            }

        } else {
            translationContainer.innerHTML = `<p class="text-sm text-red-200">Translation failed. Please try again.</p>`;
            buttonElement.innerHTML = originalButtonContent;
            buttonElement.disabled = false; 
            if (typeof lucide !== 'undefined') { lucide.createIcons(); }
        }
    } catch (error) {
        console.error("Translation API call failed:", error);
        translationContainer.innerHTML = `<p class="text-sm text-red-200">Network Error: Could not reach translation service.</p>`;
        buttonElement.innerHTML = originalButtonContent;
        buttonElement.disabled = false; 
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
    }
}

// --- MESSAGE DISPLAY FUNCTIONS ---
function displayMessage(content, sender, sources = [], isSimulation = false, messageId = null, rawText = null) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

    const messageBubble = document.createElement('div');
    messageBubble.className = `${sender === 'user' ? 'user-message' : 'bot-message'} p-4 max-w-sm md:max-w-md shadow-lg transition duration-300 ease-out transform translate-y-4 opacity-0`;
    
    if (sender === 'bot' && !isSimulation) {
        messageBubble.innerHTML = DOMPurify.sanitize(marked.parse(content));

        if (sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'mt-3 pt-2 border-t border-white/30 text-xs flex flex-wrap gap-2';
            sourcesDiv.innerHTML = `<p class="font-bold w-full mb-1 text-xs opacity-80">Sources (Live Data):</p>`;
            
            sources.forEach((source) => {
                const sourceTitle = source.title || source.uri.split('/')[2];
                sourcesDiv.innerHTML += `<a href="${source.uri}" target="_blank" class="source-tag">
                        <i data-lucide="link" class="w-3 h-3 mr-1"></i>
                        <span>${sourceTitle}</span>
                    </a>`;
            });
            
            messageBubble.appendChild(sourcesDiv);
        }
        
        if (rawText) {
            const utilityArea = document.createElement('div');
            utilityArea.className = 'mt-3 pt-2 border-t border-white/30 space-y-2';
            
            const safeRawText = rawText.replace(/`/g, '\\`').replace(/'/g, "\\'"); 

            const ttsButtonsDiv = document.createElement('div');
            ttsButtonsDiv.id = `tts-buttons-${messageId}`;
            ttsButtonsDiv.className = 'flex flex-wrap gap-2 justify-start text-xs font-medium';
            ttsButtonsDiv.innerHTML = `
                <button class="tts-button text-xs text-white/70 hover:text-white transition duration-150 flex items-center" data-message-id="${messageId}" onclick="handleMultiLanguageTTS('en', this)">
                    <i data-lucide="volume-2" class="w-4 h-4 mr-1"></i> Play (EN)
                </button>
                <button class="tts-button text-xs text-white/70 hover:text-white transition duration-150 flex items-center" data-message-id="${messageId}" onclick="handleMultiLanguageTTS('hi', this)">
                    <i data-lucide="volume-2" class="w-4 h-4 mr-1"></i> Play (HI)
                </button>
                <button class="tts-button text-xs text-white/70 hover:text-white transition duration-150 flex items-center" data-message-id="${messageId}" onclick="handleMultiLanguageTTS('mr', this)">
                    <i data-lucide="volume-2" class="w-4 h-4 mr-1"></i> Play (MR)
                </button>
            `;
            utilityArea.appendChild(ttsButtonsDiv);

            const buttonsDiv = document.createElement('div');
            buttonsDiv.id = `translate-buttons-${messageId}`;
            buttonsDiv.className = 'flex justify-end text-right space-x-2 text-xs font-medium';

            buttonsDiv.innerHTML = `
                <button class="text-xs text-white/70 hover:text-white underline p-1 rounded transition duration-150" 
                    data-lang="mr" 
                    onclick="handleInitialTranslation(this, 'mr', '${messageId}')">
                    Translate to Marathi 🇮🇳
                </button>
                <span class="text-white/50 mx-1">|</span>
                <button class="text-xs text-white/70 hover:text-white underline p-1 rounded transition duration-150" 
                    data-lang="hi" 
                    onclick="handleInitialTranslation(this, 'hi', '${messageId}')">
                    Translate to Hindi 🇮🇳
                </button>
            `;
            utilityArea.appendChild(buttonsDiv);
            
            const containerDiv = document.createElement('div');
            containerDiv.id = `translation-container-${messageId}`;
            containerDiv.dataset.originalText = safeRawText; 
            utilityArea.appendChild(containerDiv);
            
            messageBubble.appendChild(utilityArea);
        }
    } else {
        messageBubble.textContent = content;
    }

    chatBox.appendChild(messageWrapper);
    messageWrapper.appendChild(messageBubble);

    setTimeout(() => {
        messageBubble.classList.remove('translate-y-4', 'opacity-0');
        messageBubble.classList.add('translate-y-0', 'opacity-100');
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
        
        if (sender === 'user') {
            chatBox.scrollTop = chatBox.scrollHeight; 
        } else {
            scrollChatIfNearBottom(); 
        }
    }, 10);
}

function toggleLoading(show) {
    let loadingElement = document.getElementById('loading-indicator');

    if (show) {
        sendButton.disabled = true;
        userInput.disabled = true;
        micButton.disabled = true;
        
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'loading-indicator';
            loadingElement.className = 'flex justify-start';
            loadingElement.innerHTML = `
                <div class="bot-message typing-indicator p-4 max-w-sm md:max-w-md shadow-lg transition duration-300">
                    <span class="mr-1 inline-block w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0s;"></span>
                    <span class="mr-1 inline-block w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0.2s;"></span>
                    <span class="inline-block w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0.4s;"></span>
                    <span class="ml-2">MMCOE Vector is processing your request...</span>
                </div>
            `;
            chatBox.appendChild(loadingElement);
            scrollChatIfNearBottom();
        }
    } else {
        sendButton.disabled = false;
        userInput.disabled = false;
        micButton.disabled = false;
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// --- MODERATION FUNCTION ---
async function moderateContent(query) {
    const moderationPayload = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: MODERATION_SYSTEM_PROMPT }] },
    };

    try {
        const response = await fetchWithBackoff(CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(moderationPayload)
        });

        const result = await response.json();
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (responseText && responseText.toUpperCase() !== 'CLEAN') {
            return responseText; 
        }
        return true;
    } catch (error) {
        console.error("Moderation API call failed:", error);
        return true; 
    }
}

// --- SPEECH RECOGNITION ---
function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported in this browser. Feature disabled.');
        micButton.style.display = 'none';
        return;
    }

    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.continuous = false;
    speechRecognitionInstance.interimResults = false;
    speechRecognitionInstance.lang = 'en-IN';

    speechRecognitionInstance.onstart = () => {
        micButton.classList.add('mic-listening');
        micButton.innerHTML = '<i data-lucide="mic" class="w-6 h-6"></i>';
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
        userInput.placeholder = "Listening... Speak now...";
    };

    speechRecognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript.trim();
        sendMessage();
    };

    speechRecognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let message = `Voice input error: ${event.error}.`;
        if (event.error === 'not-allowed') {
            message = "Microphone access has been explicitly blocked or is restricted by the browser's **security policy** (often in embedded previews like this one). Please try reloading the page, or ensure the document is running in a secure (HTTPS) environment. 🚫";
        } else if (event.error === 'no-speech') {
            message = "No speech detected. Please speak louder and clearer.";
        } else if (event.error === 'network') {
            message = "A network error occurred during speech processing. Check your connection. 🌐";
        }
        displayMessage(message, 'bot', [], false, `err-${Date.now()}`, message);
    };

    speechRecognitionInstance.onend = () => {
        micButton.classList.remove('mic-listening');
        micButton.innerHTML = '<i data-lucide="mic-2" class="w-6 h-6"></i>';
        if (typeof lucide !== 'undefined') { lucide.createIcons(); }
        userInput.placeholder = "Ask about MMCOE... or speak to me via the mic";
    };
}

function toggleSpeechRecognition() {
    if (!speechRecognitionInstance) return;

    try {
        if (micButton.classList.contains('mic-listening')) {
            speechRecognitionInstance.stop();
        } else {
            speechRecognitionInstance.start();
        }
    } catch (e) {
        if (e.name === 'InvalidStateError') {
            console.warn("Recognition already active or starting.");
        } else {
            console.error("Error toggling speech recognition:", e);
        }
    }
}

// --- MAIN CHAT FUNCTION ---
async function sendMessage() {
    const query = userInput.value.trim();
    if (!query) return;

    displayMessage(query, 'user');
    userInput.value = '';
    toggleLoading(true);

    const moderationResult = await moderateContent(query);
    if (typeof moderationResult === 'string') {
        toggleLoading(false); 
        const modMessageId = `mod-${Date.now()}`;
        displayMessage(moderationResult, 'bot', [], false, modMessageId, moderationResult);
        userInput.focus();
        return; 
    }
    
    const messageId = `msg-${Date.now()}`;
    let rawBotText = ""; 

    try {
        const payload = {
            contents: [{ parts: [{ text: query }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        };

        const response = await fetchWithBackoff(CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        const candidate = result.candidates?.[0];
        let botText = "I apologize, an unknown error occurred when processing the AI response. Please try a different query. 😔";
        let sources = [];
        
        if (candidate && candidate.content?.parts?.[0]?.text) {
            rawBotText = candidate.content.parts[0].text;
            botText = rawBotText;
            
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }
        } else if (result.error) {
            botText = `MMCOE API Error: **${result.error.message}** Please check your network connection.`;
        }

        displayMessage(botText, 'bot', sources, false, messageId, rawBotText);
        
        addToChatHistory(query, botText);
        
    } catch (error) {
        console.error("MMCOE API Request Failed:", error);
        const errorMessage = "Network Error: Failed to connect to the Google service for RAG. Please check your internet connection. 🌐";
        displayMessage(errorMessage, 'bot');
        addToChatHistory(query, errorMessage);
    } finally {
        toggleLoading(false);
        userInput.focus();
    }
}

// --- QUICK REPLY FUNCTION ---
function quickReply(text) {
    userInput.value = text;
    sendMessage();
}

// --- SCRIPT LOADING FUNCTION ---
function loadScripts(urls, callback) {
    let loadedCount = 0;
    const totalCount = urls.length;

    if (totalCount === 0) {
        callback();
        return;
    }

    urls.forEach(url => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            loadedCount++;
            if (loadedCount === totalCount) {
                callback();
            }
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${url}`);
            loadedCount++;
            if (loadedCount === totalCount) {
                callback();
            }
        };
        document.head.appendChild(script);
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupIntroAnimation();
    }, 100);
});

// Event listeners
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !sendButton.disabled) {
        event.preventDefault(); 
        sendMessage();
    }
});

window.addEventListener('resize', function() {
    if (canvas && current_phase !== 'finished') {
        setupIntroAnimation();
    }
});

