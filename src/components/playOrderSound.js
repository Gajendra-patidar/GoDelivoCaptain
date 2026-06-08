import Sound from 'react-native-sound';

Sound.setCategory('Playback');

let soundRef = null;

export const playOrderSound = () => {
  if (soundRef) {
    return;
  }

  soundRef = new Sound('order_sound.mp3', Sound.MAIN_BUNDLE, error => {
    if (error) {
      soundRef = null;
      return;
    }

    if (!soundRef) {
      return;
    }

    soundRef.setNumberOfLoops(-1);
    soundRef.play(success => {
      if (!success) {
        stopOrderSound();
      }
    });
  });
};

export const stopOrderSound = () => {
  if (!soundRef) {
    return;
  }

  const currentSound = soundRef;
  soundRef = null;

  currentSound.stop(() => {
    currentSound.release();
  });
};
