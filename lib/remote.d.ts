export declare const eksTeamRemote: {
    name: string;
    version: number;
    methods: {
        /** Возвращает снапшот каталога для клиента. */
        snapshot: {
            input: {};
            output: {
                experts: string;
                enabled: string;
                divisions: string;
                customDivisions: string;
                customLabels: string;
                divisionLabels: string;
            };
            handler(ctx: any): Promise<any>;
        };
        /** Возвращает персону эксперта для под-агента. */
        prompt: {
            input: {
                slug: string;
                locale: string;
            };
            output: string;
            handler(ctx: any, { slug, locale }: {
                slug: string;
                locale: string;
            }): Promise<any>;
        };
        /** Включает/выключает экспертов. */
        setEnabled: {
            input: {
                list: string;
            };
            output: {
                enabled: string;
                revision: string;
            };
            handler(ctx: any, { list }: {
                list: string[];
            }): Promise<any>;
        };
        /** Скачивает ресурсы эксперта. */
        fetchAssets: {
            input: {
                slug: string;
            };
            output: {
                status: string;
                bytes: string;
                reason: string;
                root: string;
                dirs: string;
            };
            handler(ctx: any, { slug }: {
                slug: string;
            }): Promise<any>;
        };
        /** Возвращает аватары экспертов. */
        avatars: {
            input: {};
            output: string;
            handler(ctx: any): Promise<any>;
        };
        /** Создаёт своего эксперта. */
        createExpert: {
            input: {
                division: string;
                name: string;
                nameEn: string;
                description: string;
                descriptionEn: string;
                emoji: string;
                slug: string;
                persona: string;
            };
            output: {
                division: string;
                slug: string;
                path: string;
            };
            handler(ctx: any, data: any): Promise<any>;
        };
        /** Обновляет своего эксперта. */
        updateExpert: {
            input: {
                slug: string;
                division: string;
                name: string;
                nameEn: string;
                description: string;
                descriptionEn: string;
                emoji: string;
                persona: string;
                expectedHash: string;
            };
            output: {
                division: string;
                slug: string;
                path: string;
                hash: string;
            };
            handler(ctx: any, data: any): Promise<any>;
        };
        /** Удаляет своего эксперта. */
        deleteExpert: {
            input: {
                slug: string;
                division: string;
                expectedHash: string;
            };
            output: {
                ok: string;
            };
            handler(ctx: any, data: any): Promise<any>;
        };
        /** Создаёт свой раздел. */
        createCategory: {
            input: {
                division: string;
                label: string;
                labelEn: string;
            };
            output: {
                division: string;
                label: string;
                labelEn: string;
            };
            handler(ctx: any, data: any): Promise<any>;
        };
        /** Обновляет свой раздел. */
        updateCategory: {
            input: {
                division: string;
                label: string;
                labelEn: string;
            };
            output: {
                division: string;
                label: string;
                labelEn: string;
            };
            handler(ctx: any, data: any): Promise<any>;
        };
        /** Удаляет свой раздел. */
        deleteCategory: {
            input: {
                division: string;
            };
            output: {
                ok: string;
            };
            handler(ctx: any, data: any): Promise<any>;
        };
    };
};
export default eksTeamRemote;
//# sourceMappingURL=remote.d.ts.map