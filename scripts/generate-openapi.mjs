import {readFileSync,writeFileSync} from 'node:fs';
const file='docs/contracts/openapi.json',spec=JSON.parse(readFileSync(file,'utf8'));
const ref=name=>({$ref:`#/components/schemas/${name}`}),text={type:'string'},uuid={type:'string',format:'uuid'},integer={type:'integer'},minor={type:'string',pattern:'^[0-9]+$'};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:true});
const envelope=schema=>object({data:schema});
const schemas=spec.components.schemas;
schemas.MinorUnits=minor;
const profileSchema=JSON.parse(readFileSync('docs/config/store.schema.json','utf8'));delete profileSchema.$id;delete profileSchema.$schema;schemas.StoreProfile=profileSchema;

schemas.Address=object({recipient:text,line1:text,line2:text,city:text,region:text,postalCode:text,country:{type:'string',pattern:'^[A-Z]{2}$'},phone:text});
schemas.Variant=object({id:uuid,sku:text,label:text,priceMinor:minor,available:integer});
schemas.Product=object({id:uuid,slug:text,name:text,description:text,art:text,color:text,background:text,imageUrl:text,variants:{type:'array',items:ref('Variant')},rating:{type:['number','null']},reviewCount:integer});
schemas.ProductCard=object({id:uuid,slug:text,name:text,art:text,color:text,background:text,imageUrl:text,badge:text,status:text,category:object({id:uuid,name:text,slug:text}),variants:{type:'array',items:ref('Variant')},rating:{type:['number','null']},reviewCount:integer});
schemas.PromotionPreview=object({code:text,percent:integer,currency:text,subtotalMinor:minor,discountMinor:minor,totalMinor:minor,expiresAt:{type:['string','null'],format:'date-time'},items:{type:'array',items:object({variantId:uuid,quantity:integer,unitPriceMinor:minor})}});
schemas.Pagination=object({total:integer,totalItems:integer,page:integer,currentPage:integer,limit:integer,pages:integer,totalPages:integer,hasNextPage:{type:'boolean'}});
schemas.CartItem=object({id:uuid,variantId:uuid,name:text,quantity:{type:'integer',minimum:1,maximum:100},unitPriceMinor:minor,purchasable:{type:'boolean'}});
schemas.Cart=object({id:uuid,version:integer,marketId:text,currency:text,items:{type:'array',items:ref('CartItem')},subtotalMinor:minor,couponCode:{type:['string','null']}});
schemas.Totals=object(Object.fromEntries(['subtotalMinor','discountMinor','shippingMinor','taxMinor','totalMinor'].map(k=>[k,minor])));
schemas.Quote=object({id:uuid,cartId:uuid,expiresAt:{type:'string',format:'date-time'},configRevision:text,currency:text,totals:ref('Totals')});
schemas.OrderSubmission=object({id:uuid,number:text,email:text,status:text,fulfillment:text,paymentStatus:text,currency:text,totalMinor:minor,items:{type:'array',items:{type:'object'}}});
schemas.PublicConfig.properties.capabilities.properties.testWritesAllowed={type:'boolean'};
schemas.PublicConfig.properties.capabilities.properties.demoSignIn={type:'boolean'};
schemas.PublicConfig.properties.checkout=object({guestEnabled:{type:'boolean'},maxQuantityPerSku:{type:'integer',minimum:1},codEnabled:{type:'boolean'},onlinePaymentLabel:text});
schemas.PublicConfig.properties.returns=object({windowDays:integer,cancellationCutoff:text});
schemas.PublicConfig.properties.dashboard=object({pollSeconds:integer});
schemas.PublicConfig.properties.delivery={type:'array',items:{type:'object'}};
schemas.PublicConfig.properties.demo={type:'boolean'};
schemas.PublicConfig.properties.messages.additionalProperties.additionalProperties=true;
schemas.PublicConfig.properties.messages.additionalProperties.properties.onlinePaymentComingSoon=text;
const criticalResponses={'/config':ref('PublicConfig'),'/promotions/preview':ref('PromotionPreview'),'/orders/lookup':object({orderId:uuid}),'/cart':ref('Cart'),'/cart/sync':ref('Cart'),'/cart/items':ref('Cart'),'/cart/items/{id}':ref('Cart'),'/checkout/quotes':ref('Quote'),'/checkout/orders':ref('OrderSubmission'),'/products':{type:'array',items:ref('ProductCard')},'/products/{slug}':ref('Product')};
const bodies={
 '/admin/config':{...object({profile:ref('StoreProfile'),expectedRevision:text}),additionalProperties:false},
 '/auth/register':object({email:{type:'string',format:'email'},password:{type:'string',minLength:10,maxLength:128},name:{type:'string',minLength:2}}),
 '/auth/login':object({email:{type:'string',description:'Email address or username'},password:text,code:text},['email','password']),
 '/cart/items':object({variantId:uuid,quantity:{type:'integer',minimum:1,maximum:10}}),
 '/cart/items/{id}':object({quantity:{type:'integer',minimum:1,maximum:10}}),
 '/promotions/preview':{...object({code:{type:'string',minLength:1,maxLength:30},marketId:text,items:{type:'array',minItems:1,maxItems:200,items:{...object({variantId:uuid,quantity:{type:'integer',minimum:1,maximum:10}}),additionalProperties:false}}}),additionalProperties:false},
 '/cart/sync':{...object({marketId:text,couponCode:{type:['string','null']},items:{type:'array',maxItems:200,items:{...object({variantId:uuid,quantity:{type:'integer',minimum:1,maximum:10}}),additionalProperties:false}}},['marketId','items']),additionalProperties:false},
 '/cart/context':object({marketId:text}),'/cart/coupon':object({code:text}),
 '/checkout/quotes':object({contactEmail:{type:'string',format:'email'},shippingAddress:ref('Address'),shippingMethodId:text},['contactEmail','shippingAddress']),
 '/checkout/orders':{...object({quoteId:uuid,paymentMethod:{const:'COD'}}),additionalProperties:false},
 '/admin/orders/{id}/shipments':object({carrier:text,tracking:text}),
 '/admin/orders/{id}/refunds':object({amountMinor:minor,reason:text,reference:text}),
 '/admin/inventory/{id}/adjustments':object({delta:integer,reason:text,version:integer}),
};
spec.info={title:'Furniture Commerce API',version:'1.0.0',description:'Implemented React/Express commerce API. COD is the only active payment method; SSLCommerz is deferred. Mutations require an opaque session cookie and X-CSRF-Token. Start with GET /auth/csrf. Admin operations require ADMIN and MFA in production. Money is serialized as integer minor-unit strings. Listing requests default to 12 products and return pagination metadata. Guest carts are local; syncing, quoting and ordering require authentication.'};
spec.components.securitySchemes={SessionCookie:{type:'apiKey',in:'cookie',name:'kvist_session',description:'Demo/development cookie. Production uses Secure HttpOnly __Host-kvist_session.'}};
spec.paths={};
const modules=[['backend/src/app.ts','app',''],['backend/src/modules/auth.ts','auth','/auth'],['backend/src/modules/auth.ts','account','/account'],['backend/src/modules/catalog.ts','catalog',''],['backend/src/modules/commerce.ts','commerce',''],['backend/src/modules/admin.ts','admin','/admin'],['backend/src/modules/media.ts','media','/admin/media']];
for(const[file,router,prefix]of modules){const source=readFileSync(file,'utf8');const regex=new RegExp(`\\b${router}\\.(get|post|patch|put|delete)\\(\\s*['"]([^'"]+)['"]`,'g');for(const m of source.matchAll(regex)){const method=m[1],raw=m[2];if(router==='app'&&!raw.startsWith('/api/v1/'))continue;const path=((router==='app'?raw.replace('/api/v1',''):prefix+(raw==='/'?'':raw))||'/').replace(/:([a-zA-Z]+)/g,'{$1}');const mutation=!['get','head'].includes(method),parameters=[];for(const p of path.matchAll(/\{([^}]+)\}/g))parameters.push({name:p[1],in:'path',required:true,schema:p[1]==='id'?uuid:text});if(mutation)parameters.push({name:'X-CSRF-Token',in:'header',required:true,schema:text});if(path==='/checkout/orders'||path.endsWith('/refunds'))parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:16,maxLength:128}});
 const operation={operationId:method+'_'+path.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,''),summary:method.toUpperCase()+' '+path,description:path.startsWith('/admin')?'Administrator only. State transitions and stock changes are checked server-side.':path==='/auth/demo'?'Demo-only endpoint. Returns 404 in production.':'Implemented endpoint. See the operator guide and validated DTOs in the backend modules.',tags:[path.startsWith('/admin')?'Admin':path.split('/')[1]],security:path.startsWith('/admin')||mutation?[{SessionCookie:[]}]:[],responses:{[method==='post'&&['/checkout/orders','/checkout/quotes','/admin/products','/admin/media'].includes(path)?'201':'200']:{description:'Success',content:{'application/json':{schema:path==='/products'?object({data:criticalResponses[path],meta:ref('Pagination')}):envelope(criticalResponses[path]??{})}}},default:{description:'Structured error (validation, authentication, state conflict or dependency failure)',content:{'application/json':{schema:ref('Error')}}}},...(parameters.length?{parameters}: {})};
 if(mutation&&method!=='delete'){operation.requestBody={required:true,content:path==='/admin/media'?Object.fromEntries(['image/png','image/jpeg','image/webp'].map(t=>[t,{schema:{type:'string',contentEncoding:'binary',description:'Raw image bytes, maximum 2 MB. X-File-Name supplies the encoded original name.'}}])):{'application/json':{schema:bodies[path]??{type:'object'}}}};}
 if(path==='/products'&&method==='get')operation.parameters=['q','search','category','sort','page','limit','marketId','currency','minPriceMinor','maxPriceMinor','availability'].map(name=>({name,in:'query',schema:text}));
 if(method==='get' && /^\/admin\/(products|orders|categories|inventory|returns|reviews|coupons|content|audit|notifications|media)$/.test(path)){
  operation.parameters=['page','limit','q',...(path==='/admin/orders'?['status']:[])].map(name=>({name,in:'query',schema:['page','limit'].includes(name)?{type:'integer',minimum:1,...(name==='limit'?{maximum:100,default:12}:{})}:text}));
  operation.responses['200'].content['application/json'].schema=object({data:{type:'array',items:{type:'object'}},meta:ref('Pagination')});
 }
 if(path==='/orders/lookup')operation.parameters=[{name:'number',in:'query',required:true,schema:text}];
 if(path==='/product-prices')operation.parameters=['ids','marketId','currency'].map(name=>({name,in:'query',required:name==='ids',schema:text}));
 if(path==='/admin/exports/orders')operation.responses={'200':{description:'CSV download with formula-safe cells',content:{'text/csv':{schema:text}}}};
 spec.paths[path]??={};spec.paths[path][method]=operation;
}}
writeFileSync('docs/contracts/openapi.json',JSON.stringify(spec,null,2)+'\n');
console.log(`Generated ${Object.values(spec.paths).reduce((n,p)=>n+Object.keys(p).length,0)} implemented operations.`);
