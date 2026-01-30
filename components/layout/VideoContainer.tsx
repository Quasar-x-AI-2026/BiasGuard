import { useEffect, useRef } from "react";

export interface iVideoContainer {
    streamA: MediaStream | null;
    isLocalStreamA: boolean;
    isOnCall: boolean;
}

const VideoContainer = ({streamA, isLocalStreamA, isOnCall}: iVideoContainer) => {
    const videoRefA = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        if (videoRefA.current && streamA) {
            videoRefA.current.srcObject = streamA;
        }

    }, [streamA]);
    
  return (
    <div>
            <video
                ref={videoRefA}
                autoPlay
                playsInline
                muted={isLocalStreamA}

            />
        </div>
  )
}
export default VideoContainer