import React, { useState, useEffect, useRef } from "react";
import { Container } from "reactstrap";
import { getTokenOrRefresh } from "./token_util";
import "./custom.css";
import { ResultReason } from "microsoft-cognitiveservices-speech-sdk";

const speechsdk = require("microsoft-cognitiveservices-speech-sdk");

export default function App() {
	const [displayText, setDisplayText] = useState([
		{ text: "初始化完毕: 等待语音输入...", className: "" },
	]);
	const [currentRecognizingText, setCurrentRecognizingText] = useState("");
	const [player, updatePlayer] = useState({ p: undefined, muted: false });

	const outputDisplayRef = useRef(null);

	useEffect(() => {
		window.addEventListener("click", () => {});
	}, []);

	useEffect(() => {
		window.scrollTo(0, document.body.scrollHeight);
	}, [displayText]);

	async function sttFromMic() {
		const tokenObj = await getTokenOrRefresh();
		const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(
			tokenObj.authToken,
			tokenObj.region
		);
		speechConfig.speechRecognitionLanguage = "zh-CN";

		const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
		const recognizer = new speechsdk.SpeechRecognizer(
			speechConfig,
			audioConfig
		);

		recognizer.recognizing = (s, e) => {
			if (e.result.reason === ResultReason.RecognizingSpeech) {
				setCurrentRecognizingText(`转换中...: ${e.result.text}`);
			}
		};

		recognizer.recognized = (s, e) => {
			if (e.result.reason === ResultReason.RecognizedSpeech) {
				appendDisplayText(`${e.result.text}`);
				setCurrentRecognizingText("");
			} else if (e.result.reason === ResultReason.NoMatch) {
				// appendDisplayText("NOMATCH: Speech could not be recognized.");
				setCurrentRecognizingText("");
			}
		};

		recognizer.startContinuousRecognitionAsync();

		// 记得在适当的时候调用 stopContinuousRecognitionAsync 来停止识别器
		// recognizer.stopContinuousRecognitionAsync();
	}

	// async function stopSttFormMic() {
	// 	recognizer.stopContinuousRecognitionAsync();
	// }

	async function textToSpeech() {
		const tokenObj = await getTokenOrRefresh();
		const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(
			tokenObj.authToken,
			tokenObj.region
		);
		const myPlayer = new speechsdk.SpeakerAudioDestination();
		updatePlayer((p) => {
			p.p = myPlayer;
			return p;
		});
		const audioConfig = speechsdk.AudioConfig.fromSpeakerOutput(player.p);

		let synthesizer = new speechsdk.SpeechSynthesizer(
			speechConfig,
			audioConfig
		);

		const textToSpeak =
			"This is an example of speech synthesis for a long passage of text. Pressing the mute button should pause/resume the audio output.";
		setDisplayText(`speaking text: ${textToSpeak}...`);
		synthesizer.speakTextAsync(
			textToSpeak,
			(result) => {
				let text;
				if (
					result.reason === speechsdk.ResultReason.SynthesizingAudioCompleted
				) {
					text = `synthesis finished for "${textToSpeak}".\n`;
				} else if (result.reason === speechsdk.ResultReason.Canceled) {
					text = `synthesis failed. Error detail: ${result.errorDetails}.\n`;
				}
				synthesizer.close();
				synthesizer = undefined;
				setDisplayText(text);
			},
			function (err) {
				setDisplayText(`Error: ${err}.\n`);

				synthesizer.close();
				synthesizer = undefined;
			}
		);
	}

	async function handleMute() {
		updatePlayer((p) => {
			if (!p.muted) {
				p.p.pause();
				return { p: p.p, muted: true };
			} else {
				p.p.resume();
				return { p: p.p, muted: false };
			}
		});
	}

	async function fileChange(event) {
		const audioFile = event.target.files[0];
		console.log(audioFile);
		const fileInfo = audioFile.name + ` size=${audioFile.size} bytes `;

		setDisplayText(fileInfo);

		const tokenObj = await getTokenOrRefresh();
		const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(
			tokenObj.authToken,
			tokenObj.region
		);
		speechConfig.speechRecognitionLanguage = "zh-CN";

		const audioConfig = speechsdk.AudioConfig.fromWavFileInput(audioFile);
		const recognizer = new speechsdk.SpeechRecognizer(
			speechConfig,
			audioConfig
		);

		recognizer.recognizeOnceAsync((result) => {
			let text;
			if (result.reason === ResultReason.RecognizedSpeech) {
				text = `RECOGNIZED: Text=${result.text}`;
			} else {
				text =
					"ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.";
			}

			setDisplayText(fileInfo + text);
		});
	}

	function appendDisplayText(newText, className = "") {
		const formattedText = { text: newText, className };
		setDisplayText((prevTexts) => [...prevTexts, formattedText]);
	}

	function copyToClipboard(text) {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				console.log("Text copied to clipboard");
			})
			.catch((err) => {
				console.error("Error in copying text: ", err);
			});
	}

	function searchText(text) {
		// window.open(`https://www.baidu.com/s?ie=UTF-8&wd=${text}`);
		// http://ai.bb2ff.top/#/chat/1002?autosend=&sendtype=interview
		window.open(`http://gpt.whiteai.top/#/chat/1002?autosend=${text}&sendtype=interview`);
	}

	return (
		<Container className="my-container">
			{/* <h1 className="display-4 mb-3">Speech sample app</h1> */}
			<div className="row my-2 my-contorl">
				<div className="col-6">
					<i
						className="fas fa-microphone fa-lg mr-2"
						onClick={() => sttFromMic()}
					></i>
					点击麦克风开始录制
				</div>
				<div className="col-6">
					<i
						className="fas fa-volume-mute fa-lg mr-2"
						onClick={() => handleMute()}
					></i>
					点击停止
				</div>
			</div>
			<div className="col-12 output-display rounded my-message-container" ref={outputDisplayRef}>
				{displayText.map((item, index) => (
					<div key={index} className={`message ${item.className}`}>
						{item.text}
						<i
							className="copy-btn"
							onClick={() => {
								copyToClipboard(item.text);
							}}
						>
							复制
						</i>
						<i> </i>
						<i
							className="search-btn"
							onClick={() => {
								searchText(item.text);
							}}
						>
							-搜索-
						</i>
					</div>
				))}
				{currentRecognizingText && (
					<div className="message recognizing">{currentRecognizingText}</div>
				)}
			</div>
		</Container>
	);
}
