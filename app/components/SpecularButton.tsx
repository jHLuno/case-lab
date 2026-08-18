"use client";

import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import styles from "./SpecularButton.module.css";

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = sdRoundedRect(p, uHalfSize, uRadius);
  vec2 lightDirection = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;
  vec2 normal = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(normal, lightDirection)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(
    uShineSize - uShineFade,
    uShineSize + uShineFade + 1e-4,
    phi
  );
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float highlight = line * rim * edgeClamp * uIntensity;

  vec3 color = uBaseColor * base + uLineColor * highlight;
  float alpha = clamp(base + highlight, 0.0, 1.0);
  fragColor = vec4(color, alpha);
}
`;

type ButtonSize = "sm" | "md" | "lg";
type ButtonType = "button" | "submit" | "reset";

export interface SpecularButtonProps {
  children?: ReactNode;
  size?: ButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
  type?: ButtonType;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: styles.specularButtonSm,
  md: styles.specularButtonMd,
  lg: styles.specularButtonLg,
};

export default function SpecularButton({
  children = "Get Started",
  size = "lg",
  radius = 18,
  tint = "#ffffff",
  tintOpacity = 0,
  blur = 0,
  textColor = "#f5f5f5",
  lineColor = "#ffffff",
  baseColor = "#525252",
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = "",
  style,
  type = "button",
}: SpecularButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const effectRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef({
    radius,
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    speed,
    followMouse,
    proximity,
    autoAnimate,
  });

  useEffect(() => {
    const button = buttonRef.current;
    const effect = effectRef.current;
    if (!button || !effect) return;

    const dpr = window.devicePixelRatio || 1;
    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        dpr,
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 0 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    effect.appendChild(gl.canvas);

    const sizeRef = { w: 1, h: 1 };
    const lineColor = new Color();
    const baseColor = new Color();
    const resize = () => {
      const rect = button.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      sizeRef.w = width;
      sizeRef.h = height;
      renderer.setSize(width + PAD * 2, height + PAD * 2);
      program.uniforms.uCenter.value = [(PAD + width / 2) * dpr, (PAD + height / 2) * dpr];
      program.uniforms.uHalfSize.value = [(width / 2) * dpr, (height / 2) * dpr];
      program.uniforms.uRadius.value = Math.min(propsRef.current.radius, Math.min(width, height) / 2) * dpr;
      lineColor.set(propsRef.current.lineColor);
      baseColor.set(propsRef.current.baseColor);
      program.uniforms.uLineColor.value = [lineColor.r, lineColor.g, lineColor.b];
      program.uniforms.uBaseColor.value = [baseColor.r, baseColor.g, baseColor.b];
      renderer.render({ scene: mesh });
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(button);
    resize();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pointerAngle: number | null = null;
    let proximityT = 0;
    let animationFrame = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);

      if (distance === 0) {
        const nx = (event.clientX - centerX) / (rect.width / 2);
        const ny = (centerY - event.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(centerY - event.clientY, event.clientX - centerX);
      }

      const t = Math.max(0, 1 - distance / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    };

    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointerMove);

      let angle = 2.4;
      let idleAngle = 2.4;
      let bright = 0;
      let last = performance.now();

      const update = (now: number) => {
        animationFrame = requestAnimationFrame(update);
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;
        const currentProps = propsRef.current;

        idleAngle += currentProps.speed * delta;
        const steer = currentProps.followMouse && pointerAngle !== null && (!currentProps.autoAnimate || proximityT > 0);
        const target = steer && pointerAngle !== null ? pointerAngle : idleAngle;
        const difference = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angle += difference * (1 - Math.exp(-delta * 7));

        const brightTarget = currentProps.autoAnimate ? 1 : proximityT;
        bright += (brightTarget - bright) * (1 - Math.exp(-delta * 8));

        lineColor.set(currentProps.lineColor);
        baseColor.set(currentProps.baseColor);
        program.uniforms.uAngle.value = angle;
        program.uniforms.uRadius.value = Math.min(currentProps.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
        program.uniforms.uLineColor.value = [lineColor.r, lineColor.g, lineColor.b];
        program.uniforms.uBaseColor.value = [baseColor.r, baseColor.g, baseColor.b];
        program.uniforms.uIntensity.value = currentProps.intensity * bright;
        program.uniforms.uShineSize.value = (currentProps.shineSize * Math.PI) / 180;
        program.uniforms.uShineFade.value = (currentProps.shineFade * Math.PI) / 180;
        program.uniforms.uThickness.value = currentProps.thickness * dpr;
        renderer.render({ scene: mesh });
      };

      animationFrame = requestAnimationFrame(update);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      if (gl.canvas.parentNode === effect) effect.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  const buttonStyle = {
    "--sb-radius": `${radius}px`,
    "--sb-tint": tint,
    "--sb-tint-opacity": tintOpacity,
    "--sb-blur": `${blur}px`,
    "--sb-text-color": textColor,
  } as CSSProperties;

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.specularButton} ${sizeClasses[size]} ${className}`.trim()}
      style={{ ...buttonStyle, ...style }}
    >
      <span ref={effectRef} className={styles.specularButtonFx} aria-hidden="true" />
      <span className={styles.specularButtonLabel}>{children}</span>
    </button>
  );
}
