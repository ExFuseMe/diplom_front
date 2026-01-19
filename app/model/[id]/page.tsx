import ModelViewerClient from './ModelViewerClient';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ModelPage({ params }: PageProps) {
    const { id } = await params;

    return <ModelViewerClient id={id} />;
}