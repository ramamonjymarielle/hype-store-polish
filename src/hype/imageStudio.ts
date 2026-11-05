// @ts-nocheck
/**
 * HYPE Image Studio - Studio de traitement photo professionnel
 * 1. Redimensionnement automatique en format carré 1:1 SANS AUCUNE DÉFORMATION
 * 2. Suppression / isolation automatique de l'arrière-plan (détourage studio automatique)
 * 3. Choix du fond studio : Blanc pur studio, Noir profond, Transparent ou Original centré
 */

export interface StudioOptions {
  mode: 'white' | 'dark' | 'transparent' | 'original';
  removeBg: boolean;
  targetSize?: number;
}

/**
 * Traite une image uploadée depuis la galerie :
 * - Garantit un ratio 1:1 carré sans déformation
 * - Centre le vêtement / produit avec marges professionnelles
 * - Détecte et élimine l'arrière-plan de la photo (fond blanc/noir/transparent)
 */
export async function processStudioImage(
  file: File,
  options: StudioOptions = { mode: 'white', removeBg: true, targetSize: 1000 }
): Promise<string> {
  const targetSize = options.targetSize || 1000;
  const paddingPercent = 0.08; // 8% marge pour rendu catalogue aéré et professionnel

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Impossible de charger l’image'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // 1. Définir le fond de base
          if (options.mode === 'white') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetSize, targetSize);
          } else if (options.mode === 'dark') {
            ctx.fillStyle = '#111111';
            ctx.fillRect(0, 0, targetSize, targetSize);
          } else {
            // Transparent
            ctx.clearRect(0, 0, targetSize, targetSize);
          }

          // 2. Calcul du redimensionnement SANS AUCUNE DÉFORMATION (aspect ratio intact)
          const availSize = targetSize * (1 - paddingPercent * 2);
          const scale = Math.min(availSize / img.width, availSize / img.height);
          const drawW = Math.round(img.width * scale);
          const drawH = Math.round(img.height * scale);
          const offsetX = Math.round((targetSize - drawW) / 2);
          const offsetY = Math.round((targetSize - drawH) / 2);

          // Si on ne retire pas le fond, dessiner l'image directement centrée
          if (!options.removeBg && options.mode === 'original') {
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
            return;
          }

          // 3. Dessiner l'image sur un canvas temporaire pour analyser et détourer le fond
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = drawW;
          tempCanvas.height = drawH;
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
          if (!tempCtx) {
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
            return;
          }

          tempCtx.drawImage(img, 0, 0, drawW, drawH);
          const imgData = tempCtx.getImageData(0, 0, drawW, drawH);
          const data = imgData.data;

          if (options.removeBg) {
            // Échantillonnage intelligent des coins et bordures de la photo
            const samplePoints = [
              [2, 2],
              [drawW - 3, 2],
              [2, drawH - 3],
              [drawW - 3, drawH - 3],
              [Math.floor(drawW / 2), 2],
              [2, Math.floor(drawH / 2)],
              [drawW - 3, Math.floor(drawH / 2)],
            ];

            let sumR = 0, sumG = 0, sumB = 0, count = 0;
            samplePoints.forEach(([sx, sy]) => {
              const idx = (sy * drawW + sx) * 4;
              sumR += data[idx];
              sumG += data[idx + 1];
              sumB += data[idx + 2];
              count++;
            });

            const bgR = sumR / count;
            const bgG = sumG / count;
            const bgB = sumB / count;

            // Détection du seuil de tolérance (fond clair, fond de sol, drap, mur...)
            const threshold = 48;
            const feather = 18;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];

              // Distance euclidienne avec la couleur dominante d'arrière-plan
              const dist = Math.sqrt(
                Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
              );

              // Détection également des fonds quasi-blancs (surexposition studio / flash)
              const isNearWhite = (r > 238 && g > 238 && b > 238);

              if (dist < threshold || (isNearWhite && (bgR > 210 && bgG > 210 && bgB > 210))) {
                // Pixel d'arrière-plan pur -> transparent
                data[i + 3] = 0;
              } else if (dist < threshold + feather) {
                // Lissage / adoucissement des contours (antialiasing studio)
                const factor = (dist - threshold) / feather;
                data[i + 3] = Math.round(data[i + 3] * factor);
              }
            }

            tempCtx.putImageData(imgData, 0, 0);
          }

          // 4. Composition finale sur le canvas studio
          ctx.drawImage(tempCanvas, offsetX, offsetY);

          // Si mode transparent, renvoyer du PNG, sinon JPEG optimisé haute qualité
          if (options.mode === 'transparent') {
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          }
        } catch (err) {
          console.warn('Fallback studio image:', err);
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
