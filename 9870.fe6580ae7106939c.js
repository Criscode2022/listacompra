"use strict";(self.webpackChunkapp=self.webpackChunkapp||[]).push([[9870],{9870:(Z,l,a)=>{a.r(l),a.d(l,{Tab1PageModule:()=>P});var n=a(5548),u=a(6814),h=a(95),p=a(3554),g=a(4482),s=a(5861),t=a(6689),m=a(7015);function f(o,r){if(1&o){const e=t.EpF();t.TgZ(0,"ion-item")(1,"ion-label"),t._uU(2),t.qZA(),t.TgZ(3,"ion-toggle",6),t.NdJ("ionChange",function(i){const d=t.CHM(e).$implicit,C=t.oxw();return t.KtG(C.handleToggleChange(d.name,i))}),t.qZA()()}if(2&o){const e=r.$implicit;t.xp6(2),t.Oqu(e.name),t.xp6(1),t.Q6J("checked",e.checked)}}const T=[{path:"",component:(()=>{class o{constructor(e,c){this.dataService=e,this.alertController=c,this.products=[]}ngOnInit(){this.dataService.productsUpdated.subscribe(()=>{this.fetchProducts()}),this.dataService.storageInitialized.subscribe(()=>{this.fetchProducts()})}fetchProducts(){var e=this;return(0,s.Z)(function*(){e.products=yield e.dataService.getProducts(),console.log("Productos obtenidos:",e.products)})()}handleToggleChange(e,c){var i=this;return(0,s.Z)(function*(){const d=c.detail.checked;yield i.dataService.set(e,d)})()}addProduct(){var e=this;return(0,s.Z)(function*(){yield(yield e.alertController.create({header:"Nuevo producto",inputs:[{name:"productName",type:"text",placeholder:"Nombre del producto"}],buttons:[{text:"Cancelar",role:"cancel"},{text:"A\xf1adir",handler:i=>{e.dataService.set(i.productName,!0),e.fetchProducts(),location.reload()}}]})).present()})()}}return o.\u0275fac=function(e){return new(e||o)(t.Y36(m.D),t.Y36(n.Br))},o.\u0275cmp=t.Xpm({type:o,selectors:[["app-tab1-despensa"]],decls:13,vars:3,consts:[[3,"translucent"],[3,"fullscreen"],[4,"ngFor","ngForOf"],["vertical","bottom","horizontal","end","slot","fixed"],[3,"click"],["name","add"],["slot","end",3,"checked","ionChange"]],template:function(e,c){1&e&&(t.TgZ(0,"ion-header",0)(1,"ion-toolbar")(2,"ion-title"),t._uU(3," Tab 1 "),t.qZA()()(),t.TgZ(4,"ion-content",1)(5,"ion-grid")(6,"ion-row")(7,"ion-col")(8,"ion-list"),t.YNc(9,f,4,2,"ion-item",2),t.qZA()()()(),t.TgZ(10,"ion-fab",3)(11,"ion-fab-button",4),t.NdJ("click",function(){return c.addProduct()}),t._UZ(12,"ion-icon",5),t.qZA()()()),2&e&&(t.Q6J("translucent",!0),t.xp6(4),t.Q6J("fullscreen",!0),t.xp6(5),t.Q6J("ngForOf",c.products))},dependencies:[n.wI,n.W2,n.IJ,n.W4,n.jY,n.Gu,n.gu,n.Ie,n.Q$,n.q_,n.Nd,n.wd,n.ho,n.sr,n.w,u.sg]}),o})()}];let b=(()=>{class o{}return o.\u0275fac=function(e){return new(e||o)},o.\u0275mod=t.oAB({type:o}),o.\u0275inj=t.cJS({imports:[g.Bz.forChild(T),g.Bz]}),o})(),P=(()=>{class o{}return o.\u0275fac=function(e){return new(e||o)},o.\u0275mod=t.oAB({type:o}),o.\u0275inj=t.cJS({imports:[n.Pc,u.ez,h.u5,p.e,b]}),o})()}}]);