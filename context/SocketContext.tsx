"use client";

import { OngoingCall, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import { createContext, RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface iSocketContext {
    socket: Socket | null;
    isSocketConnected: boolean;
    onlineUsers: SocketUser[] | null;
}

const SocketContext = createContext<iSocketContext | null>(null)

export const SocketContextProvider = ({ children }: { children: React.ReactNode }) => {

    // Socket Setup
    const [socket, setSocket] = useState<Socket | null>(null);
    const { user } = useUser();

    useEffect(() => {
        let newSocket = io()

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        }
    }, [user])

    // Socket Connection Status
    const [isSocketConnected, setIsSocketConnected] = useState(false);

    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            setIsSocketConnected(true);
        }

        const handleDisconnect = () => {
            setIsSocketConnected(false);
        }

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
        }
    }, [socket])

    // Online Users
    const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
    const currentSocketUser = onlineUsers?.find(u => u.userId === user?.id);

    useEffect(() => {
        if (!socket || !isSocketConnected || !user) return;

        const handleOnlineUsers = (usersList: SocketUser[]) => {
            setOnlineUsers(usersList);
        };

        socket.on("get-online-users", handleOnlineUsers);
        socket.emit("add-new-user", user);

        return () => {
            socket.off("get-online-users", handleOnlineUsers);
        };
    }, [socket, isSocketConnected, user])


    return (
        <SocketContext.Provider value={{
            socket,
            isSocketConnected,
            onlineUsers,
        }}>
            {children}
        </SocketContext.Provider>
    )
}

export const useSocket = () => {
    const context = useContext(SocketContext);

    if (!context) {
        throw new Error("useSocket must be used within a SocketContextProvider")
    }

    return context;
}