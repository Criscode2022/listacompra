# Lista de la compra

## Descripción

Esta es una PWA (Progressive Web Application) y APP para Android (compilada por Capacitator) responsiva desarrollada en Angular con Ionic. Esta aplicación utiliza Ionic Storage para almacenamiento local persistente (IndexedDB gestionada de forma optimizada por Ionic) y un servicio con observables que transmite los datos dentro de la aplicación utilizando RxJS.

El objetivo de la aplicación es mostrar las capacidades de los componentes de Ionic para todo tipo de despositivos, tanto en la versión web como en la nativa. En este caso concreto, el diseño dividido en tabs aprovecha las capacidades del ciclo de vida propio de Ionic distinto del funcionamiento por defecto de Angular, como el evento "ionViewWillEnter". A diferencia de lo que ocurre en Angular, donde los componentes se inician y se destruyen cuando se renderizan en la vista, Ionic guarda en caché la navegación entre páginas y añade eventos exclusivos para realizar acciones al entrar o al salir de dichas páginas. Para el caso que nos ocupa, la aplicación actualiza los datos de la suscripción a la observable del servicio para mantener siempre sincronizados los datos.

### Front-End: Angular e Ionic.
### Almacenamiento local: Ionic Storage.

