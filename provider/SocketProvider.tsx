import { SocketContextProvider } from "@/context/SocketContext"
import { PeerContextProvider } from "@/context/PeerContext"

const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SocketContextProvider>
      <PeerContextProvider>
        {children}
      </PeerContextProvider>
    </SocketContextProvider>
  )
}
export default SocketProvider