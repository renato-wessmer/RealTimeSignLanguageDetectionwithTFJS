// Função para desenhar pontos da mão
export const drawHand = (predictions, ctx) => {
  if (predictions.length > 0) {
    predictions.forEach((prediction) => {
      const landmarks = prediction.landmarks;

      // Desenhar pontos
      for (let i = 0; i < landmarks.length; i++) {
        const [x, y] = landmarks[i];

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 3 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
      }

      // Desenhar conexões
      drawConnections(ctx, landmarks);
    });
  }
};

// Função para desenhar linhas entre os pontos da mão
const drawConnections = (ctx, landmarks) => {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],         // Polegar
    [0, 5], [5, 6], [6, 7], [7, 8],         // Indicador
    [0, 9], [9, 10], [10, 11], [11, 12],    // Médio
    [0, 13], [13, 14], [14, 15], [15, 16],  // Anelar
    [0, 17], [17, 18], [18, 19], [19, 20]   // Mindinho
  ];

  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;

  connections.forEach(([start, end]) => {
    const [x1, y1] = landmarks[start];
    const [x2, y2] = landmarks[end];

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
};

// ===== Rotulagem e suavização =====

// Ordem EXATA das classes do treino (ajuste se necessário)
export const LABELS = ['dia', 'emergencia'];

// Histórico curto para voto majoritário
const PAST = [];
const WINDOW = 8; // nº de frames considerados

// Converte índice do modelo para nome da classe (auto-detecta 0/1-based)
export const mapClassIdx = (classIdxFromModel) => {
  const offset = (classIdxFromModel >= 1 && LABELS[classIdxFromModel - 1]) ? 1 : 0;
  const idx = classIdxFromModel - offset;
  return LABELS[idx] ?? `cls_${classIdxFromModel}`;
};

// Acumula rótulos recentes e desenha o consenso no canto
export const voteAndDraw = (name, ctx) => {
  PAST.push(name);
  while (PAST.length > WINDOW) PAST.shift();

  const counts = PAST.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  // Caixa preta + texto branco com o rótulo dominante
  ctx.fillStyle = 'black';
  ctx.fillRect(8, 8, 220, 30);
  ctx.fillStyle = 'white';
  ctx.font = '18px Arial';
  ctx.fillText(`↳ ${top}`, 16, 30);

  return top;
};

// (Opcional) Se usar detector com caixas (boxes/classes/scores)
export const drawDetections = (boxes, classes, scores, threshold, imgWidth, imgHeight, ctx) => {
  if (!boxes?.[0] || !classes?.[0] || !scores?.[0]) return;

  const minClass = Math.min(...classes[0]);
  const offset = (minClass === 1) ? 1 : 0;

  for (let i = 0; i < boxes[0].length; i++) {
    const score = scores[0][i];
    if (score < threshold) continue;

    const clsRaw = classes[0][i];
    const idx = clsRaw - offset;
    const name = LABELS[idx] ?? `cls_${clsRaw}`;

    const [y1, x1, y2, x2] = boxes[0][i];

    // Caixa
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.rect(x1 * imgWidth, y1 * imgHeight, (x2 - x1) * imgWidth, (y2 - y1) * imgHeight);
    ctx.stroke();

    // Rótulo
    ctx.fillStyle = 'red';
    ctx.font = '16px Arial';
    ctx.fillText(`${name} ${(score * 100).toFixed(1)}%`, x1 * imgWidth + 4, y1 * imgHeight + 18);

    // Suavização por voto
    voteAndDraw(name, ctx);
  }
};
