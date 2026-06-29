"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { FACTION_COLORS } from "@/lib/constants";
import type { MinionSlot } from "@memetgc/types";

interface BoardSceneProps {
  playerBoard: (MinionSlot | null)[];
  opponentBoard: (MinionSlot | null)[];
  playerHp: number;
  opponentHp: number;
  playerFaction: string;
  opponentFaction: string;
  onMinionClick?: (instanceId: string, isEnemy: boolean) => void;
  onHeroClick?: (isEnemy: boolean) => void;
  highlightedIds?: string[];
  attackingId?: string | null;
}

export default function BoardScene({
  playerBoard,
  opponentBoard,
  playerHp,
  opponentHp,
  playerFaction,
  opponentFaction,
  onMinionClick,
  onHeroClick,
  highlightedIds = [],
  attackingId,
}: BoardSceneProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    hexPads: Map<string, THREE.Mesh>;
    frameId: number;
    candlesticks: THREE.Mesh[];
    candleTime: number;
  } | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const W = el.clientWidth;
    const H = el.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060810);
    scene.fog = new THREE.Fog(0x060810, 30, 60);

    // Camera — fixed isometric ~45° pitch
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0x1a2040, 0.8);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x4060ff, 0.6);
    dirLight.position.set(5, 15, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Board floor
    const floorGeo = new THREE.PlaneGeometry(20, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d1a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Center divider line
    const dividerGeo = new THREE.PlaneGeometry(18, 0.05);
    const dividerMat = new THREE.MeshBasicMaterial({ color: 0x2a3560 });
    const divider = new THREE.Mesh(dividerGeo, dividerMat);
    divider.rotation.x = -Math.PI / 2;
    divider.position.y = 0.01;
    scene.add(divider);

    // Grid lines on floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x1a2040, 0x0f1525);
    gridHelper.position.y = 0.005;
    scene.add(gridHelper);

    // Hex pads for minion slots
    const hexPads = new Map<string, THREE.Mesh>();

    function createHexPad(x: number, z: number, color: number, id: string): THREE.Mesh {
      const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.7,
        transparent: true,
        opacity: 0.7,
      });
      const pad = new THREE.Mesh(geo, mat);
      pad.position.set(x, 0.025, z);
      pad.castShadow = false;
      pad.receiveShadow = true;
      pad.userData = { id, clickable: true };
      scene.add(pad);
      hexPads.set(id, pad);
      return pad;
    }

    // Player board (z = 2) — 7 slots
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 1.3;
      createHexPad(x, 2, 0x1a3060, `player_${i}`);
    }
    // Opponent board (z = -2) — 7 slots
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 1.3;
      createHexPad(x, -2, 0x1a3060, `opponent_${i}`);
    }

    // Hero zones
    const heroGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.06, 8);

    const playerHeroMat = new THREE.MeshStandardMaterial({
      color: 0x2040a0,
      emissive: 0x1a2060,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8,
    });
    const playerHero = new THREE.Mesh(heroGeo, playerHeroMat);
    playerHero.position.set(-6, 0.03, 3.5);
    playerHero.userData = { id: "hero_player", clickable: true };
    scene.add(playerHero);

    const oppHeroMat = new THREE.MeshStandardMaterial({
      color: 0xa02020,
      emissive: 0x601a1a,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8,
    });
    const oppHero = new THREE.Mesh(heroGeo, oppHeroMat);
    oppHero.position.set(-6, 0.03, -3.5);
    oppHero.userData = { id: "hero_opponent", clickable: true };
    scene.add(oppHero);

    // Animated candlestick background
    const candlesticks: THREE.Mesh[] = [];
    for (let i = 0; i < 30; i++) {
      const h = 0.5 + Math.random() * 2;
      const geo = new THREE.BoxGeometry(0.15, h, 0.15);
      const isGreen = Math.random() > 0.5;
      const mat = new THREE.MeshStandardMaterial({
        color: isGreen ? 0x00c853 : 0xd50000,
        emissive: isGreen ? 0x00a040 : 0xb01010,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.6,
      });
      const candle = new THREE.Mesh(geo, mat);
      candle.position.set(-8 + i * 0.5, h / 2 - 0.5, -6 + Math.random() * 1);
      scene.add(candle);
      candlesticks.push(candle);
    }

    // Point lights for faction glow
    const playerColor = FACTION_COLORS[playerFaction]?.base ?? "#7b8cf4";
    const opponentColor = FACTION_COLORS[opponentFaction]?.base ?? "#f7931a";

    const pl1 = new THREE.PointLight(new THREE.Color(playerColor), 1.5, 8);
    pl1.position.set(0, 2, 3);
    scene.add(pl1);

    const pl2 = new THREE.PointLight(new THREE.Color(opponentColor), 1.5, 8);
    pl2.position.set(0, 2, -3);
    scene.add(pl2);

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onClick(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const objs = scene.children.filter((c) => c.userData.clickable);
      const hits = raycaster.intersectObjects(objs);
      if (hits.length > 0) {
        const obj = hits[0]!.object;
        const id = obj.userData.id as string;
        if (id === "hero_player" && onHeroClick) onHeroClick(false);
        else if (id === "hero_opponent" && onHeroClick) onHeroClick(true);
        else if (id?.startsWith("player_") && onMinionClick) {
          const idx = parseInt(id.split("_")[1]!);
          const slot = playerBoard[idx];
          if (slot) onMinionClick(slot.instanceId, false);
        } else if (id?.startsWith("opponent_") && onMinionClick) {
          const idx = parseInt(id.split("_")[1]!);
          const slot = opponentBoard[idx];
          if (slot) onMinionClick(slot.instanceId, true);
        }
      }
    }

    renderer.domElement.addEventListener("click", onClick);

    // Candlestick animation
    let candleTime = 0;
    let frameId = 0;

    function animate() {
      frameId = requestAnimationFrame(animate);
      candleTime += 0.01;

      // Animate candlesticks — scroll left
      for (let i = 0; i < candlesticks.length; i++) {
        const candle = candlesticks[i]!;
        candle.position.x -= 0.005;
        if (candle.position.x < -8) {
          candle.position.x = 6;
          const h = 0.5 + Math.random() * 2;
          candle.scale.y = h;
          const isGreen = (playerHp > opponentHp) ? Math.random() > 0.3 : Math.random() > 0.7;
          (candle.material as THREE.MeshStandardMaterial).color.set(isGreen ? 0x00c853 : 0xd50000);
          (candle.material as THREE.MeshStandardMaterial).emissive.set(isGreen ? 0x00a040 : 0xb01010);
        }
      }

      // Pulse hex pads for highlighted slots
      hexPads.forEach((pad, id) => {
        const mat = pad.material as THREE.MeshStandardMaterial;
        if (highlightedIds.includes(id)) {
          mat.emissiveIntensity = 0.5 + 0.3 * Math.sin(candleTime * 5);
          mat.color.set(0x40e080);
          mat.emissive.set(0x40e080);
          mat.opacity = 0.85;
        } else if (id === attackingId) {
          mat.emissiveIntensity = 0.8;
          mat.color.set(0xe04020);
          mat.emissive.set(0xe04020);
        } else {
          mat.emissiveIntensity = 0.2 + 0.1 * Math.sin(candleTime + parseInt(id.split("_")[1] ?? "0"));
          mat.color.set(0x1a3060);
          mat.emissive.set(0x1a3060);
          mat.opacity = 0.7;
        }
      });

      // Pulse hero HP lights
      const hpRatio = playerHp / 30;
      pl1.intensity = 1.0 + 0.5 * Math.sin(candleTime * 2);
      pl2.intensity = 1.0 + 0.5 * Math.sin(candleTime * 2 + Math.PI);

      renderer.render(scene, camera);
    }

    animate();

    sceneRef.current = { scene, camera, renderer, hexPads, frameId, candlesticks, candleTime: 0 };

    // Resize handler
    const container = el;
    function onResize() {
      const W2 = container.clientWidth;
      const H2 = container.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [playerFaction, opponentFaction]);

  return (
    <div
      ref={canvasRef}
      className="w-full h-full"
      style={{ background: "#060810" }}
    />
  );
}
