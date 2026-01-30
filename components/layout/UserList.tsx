"use client";

import { useSocket } from "@/context/SocketContext";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";

const UsersList = () => {
    const { socket, isSocketConnected, onlineUsers, handleCall } = useSocket();
    const { user, isLoaded } = useUser();

    if (!isLoaded || !user) {
        return <div>Loading...</div>;
    }

    return (
        <div className="m-5 px-5 flex items-center gap-4 overflow-y-auto">
            {(socket && isSocketConnected && onlineUsers) && onlineUsers.filter(u => u.userId !== user.id).map(u => {
                return <div key={u.socketId} onClick={() => handleCall(u)} className="flex flex-col items-center cursor-pointer hover:bg-gray-300 hover:text-black p-2 rounded-lg">
                    {u.profile.imageUrl && u.profile.fullName &&
                        <Image
                            src={u.profile.imageUrl}
                            alt={u.profile.fullName}
                            width={50}
                            height={50}
                            className="rounded-full"
                        />}
                    <p>{u.profile.firstName}</p>
                </div>;
            })}
        </div>
    )
}
export default UsersList