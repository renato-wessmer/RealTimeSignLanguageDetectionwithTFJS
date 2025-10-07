import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
import Webcam from "react-webcam";
import "./App.css";
import { drawHand } from "./utilities";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [gesture, setGesture] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [detectedPhrase, setDetectedPhrase] = useState([]);

  // Sequência da frase que queremos detectar
  const targetPhrase = ["bom", "dia", "emergencia"];

  const runHandpose = async () => {
    try {
      // Carregar modelo de detecção de mãos
      const net = await handpose.load();
      console.log('Modelo HandPose carregado!');
      
      // Loop de detecção
      setInterval(() => {
        detect(net);
      }, 100);
    } catch (error) {
      console.error('Erro ao carregar handpose:', error);
    }
  };

  const detect = async (net) => {
    if (!webcamRef.current || 
        !webcamRef.current.video || 
        webcamRef.current.video.readyState !== 4) {
      return;
    }

    const video = webcamRef.current.video;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Definir dimensões
    webcamRef.current.video.width = videoWidth;
    webcamRef.current.video.height = videoHeight;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    try {
      // Fazer detecção de mãos
      const hands = await net.estimateHands(video);
      const ctx = canvasRef.current.getContext("2d");
      
      // Limpar canvas
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      
      if (hands.length > 0) {
        // Desenhar pontos da mão
        drawHand(hands, ctx);
        
        // TODO: Aqui vamos classificar o gesto
        const detectedGesture = classifyGesture(hands[0]);
        
        if (detectedGesture && detectedGesture === targetPhrase[currentStep]) {
          // Gestos correto detectado!
          setGesture(detectedGesture);
          setDetectedPhrase(prev => [...prev, detectedGesture]);
          setCurrentStep(prev => prev + 1);
          
          // Reset após completar a frase
          if (currentStep >= targetPhrase.length - 1) {
            setTimeout(() => {
              setCurrentStep(0);
              setDetectedPhrase([]);
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error('Erro na detecção:', error);
    }
  };

  // Função temporária - vamos implementar a classificação real
  const classifyGesture = (hand) => {
    // SIMULAÇÃO - substituir por modelo real de classificação
    const gestures = ["bom", "dia", "emergencia"];
    return gestures[Math.floor(Math.random() * gestures.length)];
  };

  useEffect(() => {
    runHandpose();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <Webcam
          ref={webcamRef}
          muted={true}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 9,
            width: 640,
            height: 480,
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 8,
            width: 640,
            height: 480,
          }}
        />

        {/* Display da frase sendo montada */}
        <div style={{
          position: "absolute",
          top: '500px',
          fontSize: '24px',
          color: 'white',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '10px'
        }}>
          <div>Frase: {detectedPhrase.join(" ")}</div>
          <div>Próximo: {targetPhrase[currentStep]}</div>
          <div>Gestos detectado: {gesture}</div>
        </div>
      </header>
    </div>
  );
}

export default App;