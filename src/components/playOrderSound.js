import Sound from 'react-native-sound';

Sound.setCategory('Playback');

let soundRef = null;

// ▶️ PLAY SOUND
export const playOrderSound = () => {
  // agar already play ho raha hai to dubara mat chalao
  if (soundRef) {
        return;
  }

  soundRef = new Sound('order_sound.mp3', Sound.MAIN_BUNDLE, (error) => {
    if (error) {
            return;
    }

    soundRef.setNumberOfLoops(-1); // 🔁 infinite loop

    soundRef.play((success) => {
      if (!success) {
              }
    });
  });
};

// ⏹ STOP SOUND
export const stopOrderSound = () => {
  if (soundRef) {
    soundRef.stop(() => {
      soundRef.release();
      soundRef = null;
          });
  } else {
      }
};