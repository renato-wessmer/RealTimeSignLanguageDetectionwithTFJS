import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
import Webcam from "react-webcam";
import "./App.css";
import { drawHand, voteAndDraw } from "./utilities";

/**
 * Ative se estiver vendo inversão entre "dia" e "emergencia".
 * true  => troca os dois rótulos
 * false => mantém como detectado
 */
const SWAP_DIA_EMERGENCIA = true;

// Exige estabilidade do gesto por N frames antes de aceitar
const HOLD_FRAMES = 6;
// Tempo mínimo entre passos aceitos (evita repetição)
const COOL_DOWN_MS = 1500;

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  const [gesture, setGesture] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [detectedPhrase, setDetectedPhrase] = useState([]);
  const [lastDetectionTime, setLastDetectionTime] = useState(0);

  // 🔄 Sequência da frase
  const targetPhrase = ["bom", "emergencia", "dia"];

  // --- Refs para evitar "estado congelado" dentro do setInterval ---
  const stepRef = useRef(currentStep);
  const lastTimeRef = useRef(lastDetectionTime);
  useEffect(() => { stepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { lastTimeRef.current = lastDetectionTime; }, [lastDetectionTime]);

  // Contador de estabilidade por frames
  const holdRef = useRef({ label: null, count: 0 });

  // Função auxiliar para calcular distância entre pontos
  const calculateDistance = (point1, point2) => {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Distância normalizada por uma base da mão (wrist → mcp do dedo médio)
  const normalizedDistance = (p1, p2, landmarks) => {
    const baseA = landmarks[0];  // wrist
    const baseB = landmarks[9];  // middle_finger_mcp
    const base = calculateDistance(baseA, baseB) || 1;
    return calculateDistance(p1, p2) / base;
  };

  // Aplica alias para corrigir inversão (se habilitado)
  const alias = (label) => {
    if (!SWAP_DIA_EMERGENCIA) return label;
    if (label === "dia") return "emergencia";
    if (label === "emergencia") return "dia";
    return label;
  };

  // Classificador heurístico com distâncias normalizadas
  const classifyGesture = (hand) => {
    const lm = hand.landmarks;

    const thumbTip  = lm[4];
    const indexTip  = lm[8];
    const middleTip = lm[12];

    // Distâncias normalizadas (invariantes à escala)
    const thumbIndex  = normalizedDistance(thumbTip, indexTip, lm);   // polegar ↔ indicador
    const indexMiddle = normalizedDistance(indexTip, middleTip, lm);  // indicador ↔ médio

    // DEBUG (ajude-se ajustando os limites com base nesses números)
    console.log(`DEBUG norm: t-i=${thumbIndex.toFixed(2)} | i-m=${indexMiddle.toFixed(2)}`);

    // 1) "bom" = mão fechada (ambas pequenas)
    if (thumbIndex < 0.50 && indexMiddle < 0.50) return "bom";

    // 2) "emergencia" = mão aberta (bem separadas)
    if (thumbIndex > 1.05 && indexMiddle > 0.95) return "emergencia";

    // 3) "dia" = indicador estendido; demais próximos (médio não tão aberto)
    if (thumbIndex > 0.90 && indexMiddle >= 0.40 && indexMiddle <= 0.70) return "dia";

    return null;
  };

  const runHandpose = async () => {
    try {
      const net = await handpose.load();
      console.log("Modelo HandPose carregado!");

      // Loop de detecção
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        detect(net);
      }, 100);
    } catch (error) {
      console.error("Erro ao carregar handpose:", error);
    }
  };

  const detect = async (net) => {
    if (
      !webcamRef.current ||
      !webcamRef.current.video ||
      webcamRef.current.video.readyState !== 4
    ) return;

    const video = webcamRef.current.video;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Definir dimensões
    webcamRef.current.video.width = videoWidth;
    webcamRef.current.video.height = videoHeight;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    try {
      // Detecção de mãos
      const hands = await net.estimateHands(video);
      const ctx = canvasRef.current.getContext("2d");

      // Limpar canvas
      ctx.clearRect(0, 0, videoWidth, videoHeight);

      if (hands.length > 0) {
        // Desenha mão
        drawHand(hands, ctx);

        // Heurística de gesto
        const rawGesture = classifyGesture(hands[0]);

        // Mostrar sempre o último detectado bruto
        if (rawGesture) setGesture(rawGesture);

        // Suavização por voto (escreve "↳ <label>" no canto)
        let stable = null;
        if (rawGesture) stable = voteAndDraw(rawGesture, ctx);
        if (!stable) return;

        // Corrige inversão se necessário
        const label = alias(stable);

        const expected = targetPhrase[stepRef.current];
        // Atualiza contagem de estabilidade por frames
        if (label === expected) {
          if (holdRef.current.label === label) {
            holdRef.current.count += 1;
          } else {
            holdRef.current = { label, count: 1 };
          }
        } else {
          holdRef.current = { label: null, count: 0 };
        }

        // Aceita passo quando estável e respeita cooldown
        if (
          label === expected &&
          holdRef.current.count >= HOLD_FRAMES
        ) {
          const now = Date.now();
          if (now - lastTimeRef.current > COOL_DOWN_MS) {
            setDetectedPhrase((prev) => [...prev, label]);
            setCurrentStep((prev) => prev + 1);
            setLastDetectionTime(now);
            holdRef.current = { label: null, count: 0 };

            // Se completou a frase, reinicia após 3s
            const willBeStep = stepRef.current + 1;
            if (willBeStep >= targetPhrase.length) {
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
      console.error("Erro na detecção:", error);
    }
  };

  useEffect(() => {
    runHandpose();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextLabel = targetPhrase[currentStep] ?? "COMPLETO";

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
            // Se quiser espelhar a imagem para parecer "espelho":
            // transform: "scaleX(-1)",
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
        <div
          style={{
            position: "absolute",
            top: "500px",
            fontSize: "24px",
            color: "white",
            backgroundColor: "rgba(0,0,0,0.7)",
            padding: "10px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <div>
            Frase Montada: <strong>{detectedPhrase.join(" ")}</strong>
          </div>
          <div>
            Próximo Gesto: <strong>{nextLabel}</strong>
          </div>
          <div>Último Detectado: {gesture}</div>
        </div>
      </header>
    </div>
  );
}

export default App;
