// Use any just to create a skeleton to vi.mock
export class AuthService {
    constructor(
        private userRepository: any,
        private hashFn: (password: string, rounds: number) => Promise<string>
    ) {}

    async register(data: any){
        const hash = await this.hashFn(data.password, 10)
    }
}