'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Preload, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

type ChunkInfo = {
    id: number;
    file: string;
    url: string;
};

function ChunkModel({
                        url,
                        offset,
                        isSelected = false,
                    }: {
    url: string;
    offset: THREE.Vector3;
    isSelected?: boolean;
}) {
    const { scene } = useGLTF(url);

    const cloned = scene.clone(true);
    cloned.position.copy(offset);

    // Подсветка и лёгкое увеличение при выборе
    const scale = isSelected ? 1.08 : 1.0;

    cloned.scale.setScalar(scale);

    cloned.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Можно добавить более заметную подсветку через emissive
            if (isSelected && child.material) {
                child.material.emissive = new THREE.Color(0x4488ff);
                child.material.emissiveIntensity = 0.4;
            }
        }
    });

    return <primitive object={cloned} dispose={null} />;
}

interface ModelViewerClientProps {
    id: string;
}

export default function ModelViewerClient({ id }: ModelViewerClientProps) {
    const [chunks, setChunks] = useState<ChunkInfo[]>([]);
    const [totalChunks, setTotalChunks] = useState<number | null>(null);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [selectedChunkId, setSelectedChunkId] = useState<number | null>(null);

    const offset = useMemo(() => new THREE.Vector3(0, 0, 0), []);

    useEffect(() => {
        const streamUrl = `http://127.0.0.1:8000/api/models/${id}/stream-chunks`;

        const eventSource = new EventSource(streamUrl);

        eventSource.addEventListener('metadata', (e) => {
            try {
                const data = JSON.parse(e.data);
                setTotalChunks(data.total_chunks);
            } catch {}
        });

        eventSource.addEventListener('chunk', (e) => {
            try {
                const chunk = JSON.parse(e.data) as ChunkInfo;
                setChunks((prev) => {
                    if (prev.some((c) => c.id === chunk.id)) return prev;
                    return [...prev, chunk].sort((a, b) => a.id - b.id);
                });
                setLoadingProgress((p) => p + 1);
            } catch {}
        });

        eventSource.addEventListener('complete', () => eventSource.close());
        eventSource.onerror = () => eventSource.close();

        return () => eventSource.close();
    }, [id]);

    // Функция переключения выделения
    const toggleChunkSelection = (chunkId: number) => {
        setSelectedChunkId((current) =>
            current === chunkId ? null : chunkId
        );
    };

    const scale = 8;

    const progressPercent = totalChunks
        ? Math.round((loadingProgress / totalChunks) * 100)
        : 0;

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            background: '#0f0f0f',
            overflow: 'hidden'
        }}>
            {/* 3D сцена */}
            <div style={{ flex: 1, position: 'relative' }}>
                <Canvas
                    shadows
                    camera={{ position: [20, 18, 22], fov: 50 }}
                    style={{ background: '#0f0f0f' }}
                >
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[15, 20, 15]} intensity={1.4} castShadow />
                    <directionalLight position={[-10, -15, -10]} intensity={0.4} />

                    {chunks.map((chunk) => (
                        <ChunkModel
                            key={chunk.id}
                            url={chunk.url}
                            offset={offset}
                            isSelected={selectedChunkId === chunk.id}
                        />
                    ))}

                    <OrbitControls
                        enableDamping
                        dampingFactor={0.08}
                        minDistance={5}
                        maxDistance={10000}
                        rotateSpeed={0.8}
                        zoomSpeed={1.2}
                    />
                    <Preload all />
                </Canvas>

                {progressPercent < 100 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 pointer-events-none">
                        <div className="text-white text-xl font-medium bg-black/40 px-6 py-3 rounded-lg">
                            Загрузка... {progressPercent}%
                        </div>
                    </div>
                )}
            </div>

            {/* Правая панель */}
            <div
                style={{
                    width: '340px',
                    background: 'rgba(28,28,38,0.96)',
                    borderLeft: '1px solid #3a3a4a',
                    color: '#e0e0ff',
                    overflowY: 'auto',
                    padding: '16px',
                }}
            >
                <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                    Чанки
                    <span className="text-sm text-gray-400 font-normal">
            {chunks.length} / {totalChunks ?? '?'}
          </span>
                </h2>

                <div className="space-y-2">
                    {chunks.map((chunk) => {
                        const isSelected = selectedChunkId === chunk.id;

                        return (
                            <div
                                key={chunk.id}
                                onClick={() => toggleChunkSelection(chunk.id)}
                                className={`
                  p-3 rounded-md cursor-pointer transition-all duration-150 select-none
                  ${isSelected
                                    ? 'bg-blue-900/50'
                                    : 'bg-gray-800/60hover:border-blue-600/70 hover:bg-gray-700/70 active:bg-gray-600/70'}
                `}
                            >
                                <div className="font-medium text-sm">
                                    #{chunk.id} • {chunk.file}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5 truncate opacity-80">
                                    {chunk.url.split('/').pop()}
                                </div>
                            </div>
                        );
                    })}

                    {chunks.length === 0 && (
                        <div className="text-center text-gray-500 py-10">
                            Чанки ещё загружаются...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}