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