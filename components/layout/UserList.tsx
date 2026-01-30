"use client";

import { useSocket } from "@/context/SocketContext";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";

const UsersList = () => {
    const { socket, isSocketConnected, onlineUsers } = useSocket();
    const { user, isLoaded } = useUser();

    if (!isLoaded || !user) {
        return <div>Loading...</div>;
    }

    return (
        <div className="m-5 p-5">
            {(socket && isSocketConnected && onlineUsers) && onlineUsers.filter(u => u.userId !== user.id).map(u => {
                return <div key={u.socketId} className="flex flex-col items-center cursor-pointer hover:bg-gray-200 p-2 rounded-lg">
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