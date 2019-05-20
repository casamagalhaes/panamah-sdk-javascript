## Requisitos mínimos

* Node 8

## Instalação

1. Execute o comando
    ```bash
    npm install panamah-sdk-javascript --save
    ```
2. Utilize as APIs e modelos através do 
    ```javascript 
    { PanamahStream, PanamahAdmin, PanamahModels } = require('panamah-sdk-javascript')
    ```

## Visão geral

[Leia mais aqui](https://github.com/casamagalhaes/panamah-sdk-javascript/wiki/Visão-geral)

## Exemplo de uso

```javascript
const { PanamahModels, PanamahStream, PanamahAdmin } = require('panamah-sdk-javascript');
const { PanamahProduto, PanamahAssinante } = PanamahModels;

(async () => {
   //inicializando a api administrativa
   PanamahAdmin.init(process.env.PANAMAH_AUTHORIZATION_TOKEN);
   try {
      //buscando um assinante
      const assinante = await PanamahAdmin.getAssinante('18475929000132');
   } catch (e) {
      //caso não exista
      if (e.name === 'PanamahNotFoundError') {
         //instanciando um modelo de assinante
         const assinante = new PanamahAssinante({
            id: '18475929000132',
            fantasia: 'Supermercado Exemplo',
            nome: 'Supermercado Exemplo Ltda',
            bairro: 'Rua Poebla',
            cidade: 'Caucaia',
            uf: 'CE'
         });
         //criando o assinante no Panamah
         await PanamahAdmin.createAssinante(assinante);
      }
   }

   //inicializando a api de streaming
   PanamahStream.init(
      process.env.PANAMAH_AUTHORIZATION_TOKEN,
      process.env.SECRET,
      '18475929000132'
   );

   PanamahStream.on('before_save', (model, preventSave) => {
      console.log('Before save', model);
      //preventSave(); //essa linha cancelaria o salvamento
   });

   PanamahStream.on('before_delete', (model, preventDelete) => {
      console.log('Before delete', model);
      //preventDelete(); //essa linha cancelaria a deleção
   });

   const produto = new PanamahProduto({
      id: '1111',
      descricao: 'Coca-cola',
      dataInclusao: new Date().toISOString(),
      secaoId: '999',
      composicao: {
         quantidade: 2,
         itens: [
            {
               produtoId: '432',
               quantidade: 1
            },
            {
               produtoId: '567',
               quantidade: 1
            }
         ]
      },
      fornecedores: [
         {
            id: '222',
            principal: true
         }
      ]
   });

   try {
      //salvando um produto
      PanamahStream.save(produto);
   } catch (e) {
      if(e.name === 'PanamahValidationError') {
         console.error(e); //um erro de validação seria tratado aqui
      }
   }

   //deletando um produto
   PanamahStream.delete(produto);

   //sempre chamar antes de finalizar a aplicação
   await PanamahStream.flush();
})();
```
