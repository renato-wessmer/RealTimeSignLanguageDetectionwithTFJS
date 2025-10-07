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
  const [lastDetectionTime, setLastDetectionTime] = useState(0);

  // Sequência da frase que queremos detectar
  const targetPhrase = ["bom", "dia", "emergencia"];

  // Função auxiliar para calcular distância entre pontos
  const calculateDistance = (point1, point2) => {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  const classifyGesture = (hand) => {
    const landmarks = hand.landmarks;
    
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    
    const thumbIndexDistance = calculateDistance(thumbTip, indexTip);
    const indexMiddleDistance = calculateDistance(indexTip, middleTip);
    
    console.log(`DEBUG: thumb-index=${thumbIndexDistance.toFixed(0)}, index-middle=${indexMiddleDistance.toFixed(0)}`);
    
    // Gesto "bom" - mão fechada
    if (thumbIndexDistance < 60 && indexMiddleDistance < 60) {
      console.log("✅ Detectado: BOM");
      return "bom";
    }
    
    // Gesto "dia" - só indicador estendido (dedos MÉDIO, ANELAR, MINDINHO FECHADOS)
    if (thumbIndexDistance > 160 && indexMiddleDistance < 120) {
      console.log("✅ Detectado: DIA");
      return "dia";
    }
    
    // Gesto "emergencia" - mão aberta (todos dedos SEPARADOS)
    if (thumbIndexDistance > 160 && indexMiddleDistance > 150) {
      console.log("✅ Detectado: EMERGENCIA");
      return "emergencia";
    }
    
    console.log("❌ Nenhum gesto reconhecido");
    return null;
  };

  // 🔥 FUNÇÃO runHandpose ADICIONADA AQUI
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
        drawHand(hands, ctx);
        const detectedGesture = classifyGesture(hands[0]);
        
        if (detectedGesture) {
          setGesture(detectedGesture); // Mostra sempre o último detectado
        }
        
        // Só avança se for o próximo gesto correto na sequência
        if (detectedGesture && detectedGesture === targetPhrase[currentStep]) {
          const now = Date.now();
          if (now - lastDetectionTime > 2000) { // 2 segundos
            console.log(`🎉 AVANÇANDO: ${detectedGesture} -> Próximo: ${targetPhrase[currentStep + 1] || 'COMPLETO'}`);
            setDetectedPhrase(prev => [...prev, detectedGesture]);
            setCurrentStep(prev => prev + 1);
            setLastDetectionTime(now);
            
            // Reset após completar a frase
            if (currentStep >= targetPhrase.length - 1) {
              setTimeout(() => {
                setCurrentStep(0);
                setDetectedPhrase([]);
                console.log("🔄 Frase completa! Reiniciando...");
              }, 3000);
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro na detecção:', error);
    }
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
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <div>Frase Montada: <strong>{detectedPhrase.join(" ")}</strong></div>
          <div>Próximo Gestos: <strong>{targetPhrase[currentStep]}</strong></div>
          <div>Último Detectado: {gesture}</div>
        </div>
      </header>
    </div>
  );
}

export default App;