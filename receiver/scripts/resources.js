window.cc.resources = {
    default: {
        readyMessage: 'Ready to cast',
        errorSources: {
            video: {
                name: 'HTML video',
                errorCodes: {
                    100: 'An error occurred during playback, please try again.',
                    200: 'Content playback has stopped due to network conditions.',
                    300: 'Unable to load external text track.',
                    unknown: 'An error occurred during playback, please try again.'
                }
            },
            license: {
                name: 'License Server',
                errorCodes: {
                    100: 'We were unable to acquire the license.',
                    unknown: 'We were unable to acquire the license.'
                }
            },
            api: {
                name: 'Core API',
                errorCodes: {
                    1001: 'This title is not available for this account.',
                    1002: 'This title is not available for this account.',
                    1005: 'This title is not available for this account.',
                    1004: 'This title is not available for this account.',
                    920: 'This title is not available for this account.',
                    964: 'This title is not available for this account.',
                    1050: 'Your account has reached its maximum stream limit.',
                    994: 'Your account has reached its maximum stream limit.',
                    109: 'Your session has expired, please login again.',
                    114: 'Your session has expired, please login again.',
                    unknown: 'A network error occurred trying to reach the Core API, please try again.'
                }
            }
        }
    },
    'fr-FR': {
        readyMessage: 'Prêt à jeter',
        errorSources: {
            video: {
                name: 'HTML video',
                errorCodes: {
                    100: 'Une erreur est survenue lors de la lecture , s\'il vous plaît essayer à nouveau.',
                    200: 'La lecture de contenu a cessé en raison des conditions du réseau.',
                    300: 'Impossible de charger la piste de texte externe.',
                    unknown: 'Une erreur est survenue lors de la lecture , s\'il vous plaît essayer à nouveau.'
                }

            },
            license: {
                name: 'License Server',
                errorCodes: {
                    100: 'Nous étions incapables d\'acquérir la licence.',
                    unknown: 'Nous étions incapables d\'acquérir la licence.'
                }
            },
            api: {
                name: 'Core API',
                errorCodes: {
                    1001: 'Ce titre ne sont pas disponibles pour ce compte.',
                    1002: 'Ce titre ne sont pas disponibles pour ce compte.',
                    1005: 'Ce titre ne sont pas disponibles pour ce compte.',
                    1004: 'Ce titre ne sont pas disponibles pour ce compte.',
                    920: 'Ce titre ne sont pas disponibles pour ce compte.',
                    964: 'Ce titre ne sont pas disponibles pour ce compte.',
                    1050: 'Votre compte a atteint sa limite maximale de flux.',
                    994: 'Votre compte a atteint sa limite maximale de flux.',
                    109: 'Votre session a expiré , s\'il vous plaît vous connecter à nouveau.',
                    114: 'Votre session a expiré , s\'il vous plaît vous connecter à nouveau.',
                    unknown: 'Une erreur de réseau est survenue en essayant d\'atteindre l\'API de base , s\'il vous plaît essayer à nouveau.'
                }
            }
        }
    }
};
