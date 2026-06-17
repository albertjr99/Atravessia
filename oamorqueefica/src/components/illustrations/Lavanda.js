import React from 'react';
import Svg, { Path, Ellipse, Circle, G, Line } from 'react-native-svg';

export function LavandaHeader({ width = 160, height = 120 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 120">
      {/* Caule principal esquerdo */}
      <Path d="M30 110 Q28 80 32 50 Q34 30 30 10" stroke="#B8C8A8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Flores lavanda esquerda */}
      <G>
        <Ellipse cx="30" cy="10" rx="4" ry="7" fill="#C8B8DB" opacity="0.85"/>
        <Ellipse cx="25" cy="18" rx="3.5" ry="6" fill="#D4C4E4" opacity="0.8"/>
        <Ellipse cx="35" cy="16" rx="3.5" ry="6" fill="#BCA8D0" opacity="0.8"/>
        <Ellipse cx="22" cy="28" rx="3" ry="5" fill="#C8B8DB" opacity="0.7"/>
        <Ellipse cx="38" cy="26" rx="3" ry="5" fill="#D4C4E4" opacity="0.7"/>
        <Ellipse cx="28" cy="35" rx="3" ry="5" fill="#BCA8D0" opacity="0.65"/>
        <Ellipse cx="33" cy="35" rx="3" ry="5" fill="#C8B8DB" opacity="0.65"/>
      </G>
      {/* Caule secundário esquerdo */}
      <Path d="M45 110 Q43 85 46 60 Q48 40 44 20" stroke="#B8C8A8" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <G>
        <Ellipse cx="44" cy="20" rx="3.5" ry="6" fill="#D4C4E4" opacity="0.8"/>
        <Ellipse cx="40" cy="28" rx="3" ry="5" fill="#C8B8DB" opacity="0.75"/>
        <Ellipse cx="48" cy="27" rx="3" ry="5" fill="#BCA8D0" opacity="0.75"/>
        <Ellipse cx="42" cy="37" rx="2.5" ry="4.5" fill="#D4C4E4" opacity="0.65"/>
        <Ellipse cx="46" cy="37" rx="2.5" ry="4.5" fill="#C8B8DB" opacity="0.65"/>
      </G>
      {/* Folhas pequenas esquerda */}
      <Path d="M30 70 Q20 65 18 58" stroke="#B8C8A8" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <Ellipse cx="18" cy="57" rx="5" ry="3" fill="#C8D8B8" opacity="0.6" transform="rotate(-30 18 57)"/>
      <Path d="M30 80 Q22 78 20 72" stroke="#B8C8A8" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <Ellipse cx="19" cy="71" rx="5" ry="3" fill="#C8D8B8" opacity="0.55" transform="rotate(-20 19 71)"/>

      {/* Caule direito */}
      <Path d="M130 110 Q132 80 128 50 Q126 30 130 10" stroke="#B8C8A8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <G>
        <Ellipse cx="130" cy="10" rx="4" ry="7" fill="#BCA8D0" opacity="0.85"/>
        <Ellipse cx="125" cy="18" rx="3.5" ry="6" fill="#C8B8DB" opacity="0.8"/>
        <Ellipse cx="135" cy="16" rx="3.5" ry="6" fill="#D4C4E4" opacity="0.8"/>
        <Ellipse cx="122" cy="28" rx="3" ry="5" fill="#BCA8D0" opacity="0.7"/>
        <Ellipse cx="138" cy="26" rx="3" ry="5" fill="#C8B8DB" opacity="0.7"/>
        <Ellipse cx="127" cy="35" rx="3" ry="5" fill="#D4C4E4" opacity="0.65"/>
        <Ellipse cx="133" cy="35" rx="3" ry="5" fill="#BCA8D0" opacity="0.65"/>
      </G>
      {/* Caule secundário direito */}
      <Path d="M115 110 Q117 85 114 60 Q112 40 116 20" stroke="#B8C8A8" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <G>
        <Ellipse cx="116" cy="20" rx="3.5" ry="6" fill="#C8B8DB" opacity="0.8"/>
        <Ellipse cx="112" cy="28" rx="3" ry="5" fill="#D4C4E4" opacity="0.75"/>
        <Ellipse cx="120" cy="27" rx="3" ry="5" fill="#BCA8D0" opacity="0.75"/>
        <Ellipse cx="113" cy="37" rx="2.5" ry="4.5" fill="#C8B8DB" opacity="0.65"/>
        <Ellipse cx="118" cy="37" rx="2.5" ry="4.5" fill="#D4C4E4" opacity="0.65"/>
      </G>
      {/* Folhas direita */}
      <Path d="M130 70 Q140 65 142 58" stroke="#B8C8A8" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <Ellipse cx="143" cy="57" rx="5" ry="3" fill="#C8D8B8" opacity="0.6" transform="rotate(30 143 57)"/>
      <Path d="M130 80 Q138 78 140 72" stroke="#B8C8A8" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <Ellipse cx="141" cy="71" rx="5" ry="3" fill="#C8D8B8" opacity="0.55" transform="rotate(20 141 71)"/>
    </Svg>
  );
}

export function LavandaSmall({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M20 38 Q19 28 20 18 Q21 10 20 4" stroke="#B8C8A8" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <Ellipse cx="20" cy="4" rx="3" ry="5" fill="#C8B8DB" opacity="0.9"/>
      <Ellipse cx="16" cy="10" rx="2.5" ry="4" fill="#D4C4E4" opacity="0.85"/>
      <Ellipse cx="24" cy="10" rx="2.5" ry="4" fill="#BCA8D0" opacity="0.85"/>
      <Ellipse cx="17" cy="17" rx="2" ry="3.5" fill="#C8B8DB" opacity="0.75"/>
      <Ellipse cx="23" cy="17" rx="2" ry="3.5" fill="#D4C4E4" opacity="0.75"/>
    </Svg>
  );
}

export function FlorzinhaPeach({ size = 30 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Path d="M15 28 Q14 20 15 12" stroke="#C8B8A0" strokeWidth="1" fill="none"/>
      <Ellipse cx="15" cy="8" rx="5" ry="8" fill="#EFD5C0" opacity="0.7"/>
      <Ellipse cx="10" cy="14" rx="4" ry="6" fill="#E8C4A8" opacity="0.6"/>
      <Ellipse cx="20" cy="14" rx="4" ry="6" fill="#EFD5C0" opacity="0.6"/>
    </Svg>
  );
}
