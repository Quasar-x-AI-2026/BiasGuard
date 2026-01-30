import { User } from "@clerk/nextjs/server";

export type SocketUser = {
    socketId: string;
    userId: string;
    profile: User;
}

export type OngoingCall = {
    participants: Participants;
    isRinging: boolean;
    role: string;
}

export type Participants = {
    caller: SocketUser;
    receiver: SocketUser;
}