import { useState } from 'react';
import { Subtitle } from '../types';

export function useSubtitles() {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);

  return { subtitles, setSubtitles };
}
