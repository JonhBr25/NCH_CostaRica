/**
 * @NApiVersion 2.x
 * @NModuleScope Public 
 */

 define(["N/record", "N/runtime", "N/file", "N/email", "N/encode", "N/search", "N/format", "N/xml", 'N/https'], 
 	function(record, runtime, file, email, encode, search, format, xml, https) {

		var URL_WS      = '';
		var USER        = '';
		var PASSWORD    = '';
		var	URL_PD_WS   = '';
		var URL_CER_WS  = '';
		var HOST_WS     = '';
		var AMBIENTE_WS = '';
		var FORMATO_WS  = '';

		var SesionId    	 = '';
		var FechaVencimiento = '';
		var TransaccionId    = '';
		var internalId       = '';
		var tranID 			 = '';
		var Sender			 = '';
		var Semail			 = '';
		var subsi			 = '';
		var cuitId           = '';//RUT EMISOR
		var codDoc           = '';//TIPO DE DOCUMENTO
		var serDoc			 = '';//SERIE DE DOCUMENTO
		var numDoc			 = '';//NUMERO DE DOCUMENTO SIN SERIE
		var puntoDeVentaIdWS = '';//PUNTO DE VENTA SEGUN TRANSACTION 01=FACTURA
		var estado_comfiar   = '';
		var date_comfiar	 = '';
		var estado_dgt		 = '';
		var PDF              = '';
		var tranprefix 		 = '';
		var typedoc			 = 'F';
		var identifydoc		 = '';
		var mesagedoc		 = '';
		var debitnote		 = '';
		var statesend		 =  0;
		var idcomfiar		 = '';
		var rec 			 = '';
		var XMLCR			 = '';
		var idClient		 = '';

		function send (plugInContext ) {

			var result = {
				success: true,
				message: "Success!"
			};
			try {

				rec = record.load({
					type : record.Type.INVOICE,
					id   : plugInContext.transaction.id
				});

				getEnableFeatures();//PARAMETROS INICIALES

				var returnIniSesion	= WSIniSesion();
				if( returnIniSesion.Error ) throw "Error al Iniciar Sesion: " + returnIniSesion.Mensaje;		

				internalId = plugInContext.transaction.id;
				tranID     = plugInContext.transaction.number;
				Sender     = plugInContext.sender.id;
				Semail	   = plugInContext.sender.email;
				subsi      = rec.getValue('subsidiary');
				debitnote  = rec.getValue('customform');
				statesend  = rec.getValue('custbody_nch_code_state');
				idcomfiar  = rec.getValue('custbody_nch_tran_id');
				idClient   = rec.getValue('entity');
				serDoc	   = '00';

				
				if( Sender == "" || Sender == null ) Sender = "-System-";


				var xmlEnvio = plugInContext.eInvoiceContent;
				xmlEnvio 	 = xmlEnvio.replace(/<br\s*[\/]?>/gi, " ");

				// OBTENEMOS TRANID Y ENVIAMOS A 8 POSICIONES
				var notranid = xmlEnvio.split('-TRANID-')[1];
				var num_last = '-TRANID-' + notranid + '-TRANID-';
				var num_new  = tranID.substring(2, 9);
				var pad 	 = "00000000";
				num_new 	 = pad.substring(0, pad.length - num_new.length) + num_new;
				xmlEnvio 	 = xmlEnvio.replace(num_last, num_new);

				tranprefix = 'CR';

				var objCustomer = record.load({
					type: record.Type.CUSTOMER,
					id: idClient
					});

				var FlagExpor = objCustomer.getValue('custentity_nch_entity_foreing');
				var CodDoc43 = '';

				if(FlagExpor == true)
					CodDoc43 = '09';
				else	
					CodDoc43 = '01';				


		       	// TIPO DE DOCUMENTO
		       	codDoc = (debitnote == '876')? '02' : CodDoc43 ;


				//LOGICA PARA OBTENER PUNTO DE VENTA
				 //SANDBOX
				if(AMBIENTE_WS == 1){
					puntoDeVentaIdWS = '100001';//FACTURA
				}else{
					puntoDeVentaIdWS = '100001';//FACTURA
				}

				//CASES TO CR 171018
				switch( statesend )
				{
					case 0:
						var Rzero = ejecutaprocesozero( xmlEnvio );
						if( Rzero.Error ) throw Rzero.Mensaje;
					break;

					case 1:
						var Runo = ejecutaprocesouno( xmlEnvio );
						if( Runo.Error ) throw Runo.Mensaje;
					break;

					case 2:
						var Rdos = ejecutaprocesodos( xmlEnvio );
						if( Rdos.Error ) throw Rdos.Mensaje;
					break;

					case 3:
						var Rtres = ejecutaprocesotres( xmlEnvio );
						if( Rtres.Error ) throw Rtres.Mensaje;
					break;
				}

				rec.save({
					enableSourcing: true,
					ignoreMandatoryFields: true
					});

			} catch (e) {
				result.success = false;
				result.message = String( e );
				//SAVE THE LOG IN NCH Log Lote de Envio EI 
				var logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
				logRecord.setValue('custrecord_nch_envio_subsi'	  , subsi );
				logRecord.setValue('custrecord_nch_envio_user'    , Sender );
				logRecord.setValue('custrecord_nch_envio_transac' , internalId );
				logRecord.setValue('custrecord_nch_envio_estado'  , String(e).substring(0,300));
				logRecord.save();
				rec.save();
				//sendMail(xmlEnvio, returnSalidaTransac, returnRespCbte, PDF, Sender, Semail);
			}

			return result;
		}

		function ejecutaprocesozero( xmlEnvio )
		{
			try{

				var objresp = {};

				//CONSULTA ULTIMO NUMERO EN COMFIAR Y ASIGNA CORRELATIVOS Y NROCBTE
				var returnUltimoNroCbte = WSUltimoNroCbte();
				if( returnUltimoNroCbte.Error ) throw "Error al Obtener el último comprobante: " + returnUltimoNroCbte.Mensaje  ;

				//Sustituye el NumDoc Numero de comprobante
				var numeracion = xmlEnvio.split('-NUMERACION-')[1];
				var numeracion_last = '-NUMERACION-' + numeracion + '-NUMERACION-';
				var numeracion_new  = numDoc;
				xmlEnvio = xmlEnvio.replace(numeracion_last, numeracion_new);

				var numeracion2 = xmlEnvio.split('-NUMERACION2-')[1];
				var numeracion_last2 = '-NUMERACION2-' + numeracion2 + '-NUMERACION2-';
				var numeracion_new2  = numDoc;
				xmlEnvio = xmlEnvio.replace(numeracion_last2, numeracion_new2);	

				//throw tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc; 		

				grabaEstadoEntidadFiscal();

				//FUNCTION ASINCRONA
			 	var returnAutCbtsAsinc = WSAutCbtsAsinc( xmlEnvio );
			 	if( returnAutCbtsAsinc.Error ) throw "Error al Cargar el XML: " + returnAutCbtsAsinc.Mensaje;


				// Tiempo de espera de respuesta de COMFIAR
				sleep(15000);// AQUI MAS



				var RspSalidaTran = WSSalidaTransac( xmlEnvio );
				if( RspSalidaTran.Error ) throw "Error al Obtener la salida de la transaccion: " + RspSalidaTran.Mensaje ;


				sleep(5000);


				var ReturnRespCbte = WSRespCbte(xmlEnvio, RspSalidaTran.Datos);
				if( ReturnRespCbte.Error ) throw "Error al Obtener la respueta del comprobante: " + ReturnRespCbte.Mensaje ;


	            var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

		        guardaPDF( ReturnRespCbte.Datos );

		        var returnDescargaXML = WSDescargarXML();
	        	if( returnDescargaXML.Error ) throw "Error al Obtener XML del proveedor: " + returnDescargaXML.Mensaje ;


	         	objresp.Error = false;

	        }catch(e){
				objresp.Error = true;
	         	objresp.Mensaje = String(e);
	        }
	        return objresp;
		}

		function ejecutaprocesouno(xmlEnvio)
		{
			try{

				var objresp = {};

				numDoc 		   = rec.getValue('custbody_numero_doc');
			 	TransaccionId  = parseInt( idcomfiar);

				var RspSalidaTran = WSSalidaTransac( xmlEnvio );
				if( RspSalidaTran.Error ) throw "Error al Obtener la salida de la transaccion: " + RspSalidaTran.Mensaje ;


				sleep(5000);


				var ReturnRespCbte = WSRespCbte(xmlEnvio, RspSalidaTran.Datos);
				if( ReturnRespCbte.Error ) throw "Error al Obtener la respueta del comprobante: " + ReturnRespCbte.Mensaje ;


	            var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

	            var returnDescargaXML = WSDescargarXML();
	        	if( returnDescargaXML.Error ) throw "Error al Obtener XML del proveedor: " + returnDescargaXML.Mensaje ;

		        guardaPDF(ReturnRespCbte.Datos);

	         	objresp.Error = false;

	        }catch(e){
	         	objresp.Error = true;
	         	objresp.Mensaje = String(e);
	        }
	        return objresp;
		}

		function ejecutaprocesodos(xmlEnvio)
		{
			try{

				var objresp = {};

				numDoc 		  = rec.getValue('custbody_numero_doc');
			 	TransaccionId = parseInt(idcomfiar);
			 	RspSalidaTran = rec.getValue('custrecord_nch_envio_descri');

				var ReturnRespCbte = WSRespCbte(xmlEnvio, RspSalidaTran);
				if( ReturnRespCbte.Error ) throw "Error al Obtener la respueta del comprobante: " + ReturnRespCbte.Mensaje ;


	            var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

		        guardaPDF(ReturnRespCbte.Datos);

		        var returnDescargaXML = WSDescargarXML();
	        	if( returnDescargaXML.Error ) throw "Error al Obtener XML del proveedor: " + returnDescargaXML.Mensaje ;

	         	objresp.Error = false;

	        }catch(e){
	         	objresp.Error = true;
	         	objresp.Mensaje = String(e);
	        }
	        return objresp;
		}

		function ejecutaprocesotres(xmlEnvio)
		{
			try{

				var objresp = {};

				numDoc 		       = rec.getValue('custbody_numero_doc');
			 	TransaccionId  	   = parseInt(idcomfiar);
			 	var ReturnRespCbte = rec.getValue('custrecord_nch_envio_descri');

				var returnDescargarPdf = WSDescargarPdf();//CONSULTA PARA TRAER EL PDF EN BASE 64

		        guardaPDF( ReturnRespCbte );

		        var returnDescargaXML = WSDescargarXML();
	        	if( returnDescargaXML.Error ) throw "Error al Obtener XML del proveedor: " + returnDescargaXML.Mensaje ;


	         	 objresp.Error = false;

	         }catch(e){
	         	objresp.Error = true;
	         	objresp.Mensaje = String(e);
	         }
	         return objresp;
		}

		function grabaEstadoProveedor() {
			rec.setValue('custbody_state_comfiar_pe' 		, estado_comfiar						  );
			rec.setValue('custbody_date_comfiar_pe'			, date_comfiar 							  );
			rec.setValue('custbody_lmry_webserviceerror'	, 'Identificador Comfiar'+' '+identifydoc );
			rec.setValue('custbody_lmry_webserviceresponse'	, mesagedoc 							  );
		}

		function grabaEstadoEntidadFiscal() {

			//throw 'WorkFlow :'+ ' ' +tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc;
			rec.setValue('tranid'							, tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
			rec.setValue('custbody_state_sunat_pe'			, estado_dgt 										);
			rec.setValue('custbody_lmry_webserviceerror'	, 'Identify DGT '+' '+identifydoc 					);
			rec.setValue('custbody_lmry_webserviceresponse' , mesagedoc 										);
		}


		function guardaPDF(returnRespCbte) {
			try
			{
				var objRespuesta = {};

				rec.setValue('tranid', tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc);
				rec.setValue('custbody_lmry_webserviceerror', "Emision exitosa");
				rec.setValue('custbody_lmry_webserviceresponse', returnRespCbte);

		        //SAVE FILE IN NETSUITE
				var fileObj = file.create({
					name 	 : 'F '+serDoc+puntoDeVentaIdWS+codDoc+numDoc+'.pdf',
					fileType : file.Type.PDF,
					contents : PDF
				});

				fileObj.folder = 2681223;
				var id  = fileObj.save();
				fileObj = file.load({
					id: id
				});

				 //SAVE FILE IN TRASACTION
	            var idtran = fileObj.id;
	            rec.setValue('custbody_pdf_cl', idtran);  

				objRespuesta.Error = false;
			}catch(e)
			{
				objRespuesta.Error   = true;
				objRespuesta.Mensaje = String(e);

			}
			return objRespuesta;
		}

		function WSIniSesion(){
			try{
				var objRespuesta = {};

				var StringXML = 
				'<?xml version="1.0" encoding="utf-8"?>'+
				'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
				'<soap:Body>'+
				'<IniciarSesion xmlns="http://comfiar.com.ar/webservice/">'+
				'	<usuarioId>'+USER+'</usuarioId>'+
				'	<password>'+PASSWORD+'</password>'+
				'</IniciarSesion>'+
				'</soap:Body>'+
				'</soap:Envelope>';

				var soapHeaders = new Array();
				soapHeaders['Host'] 		  = HOST_WS;
				soapHeaders['Content-Type']   = 'text/xml; charset=utf-8'; 
				soapHeaders['Content-Length'] = 'length';
				soapHeaders['SOAPAction']     = "http://comfiar.com.ar/webservice/IniciarSesion";

				var objIniSesion = '';
				if (AMBIENTE_WS == '1') {
					require(['N/http'], function(http) {
						objIniSesion    =
						http.post({
							url: URL_CER_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}else if(AMBIENTE_WS == '2'){
					require(['N/https'], function(https) {
						objIniSesion    =
						https.post({
							url: URL_PD_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}

				if( objIniSesion.code != 200 ) throw "Código de error " + objIniSesion.code + " en el inicio de sesión del WebService";

				var ObjXMLResponse  = xml.Parser.fromString({text:objIniSesion.body}) ;

				SesionId 		 = ObjXMLResponse.getElementsByTagName( {tagName: 'SesionId'		 } )[0].textContent ;
				FechaVencimiento = ObjXMLResponse.getElementsByTagName( {tagName: 'FechaVencimiento' } )[0].textContent ;

				objRespuesta.Error = false;

			}catch(e)
			{
				objRespuesta.Error   = true;
				objRespuesta.Mensaje = String( e );
			}

			return objRespuesta;
		}

		function WSAutCbtsAsinc(xmlEnvio){
			try{
				var objRespuesta = {};

				var StringXML = 
				'<?xml version="1.0" encoding="utf-8"?>'+
				'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
				'<soap:Body>'+
				'<AutorizarComprobantesAsincronico xmlns="http://comfiar.com.ar/webservice/">'+
				'<XML><![CDATA['+xmlEnvio+']]></XML>'+
				'<cuitAProcesar>'+cuitId+'</cuitAProcesar>'+
				'<puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
				'<tipoDeComprobanteId>'+codDoc+'</tipoDeComprobanteId>'+
				'<formatoId>'+FORMATO_WS+'</formatoId>'+
				'<token>'+
				'<SesionId>'+SesionId+'</SesionId>'+
				'<FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
				'</token>'+
				'</AutorizarComprobantesAsincronico>'+
				'</soap:Body>'+
				'</soap:Envelope>'; 

				var soapHeaders = new Array(); 
				soapHeaders['Host'] = HOST_WS;
				soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
				soapHeaders['Content-Length'] = 'length';
				soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/AutorizarComprobantesAsincronico";

				var objAutCbtsAsinc = '';
				if (AMBIENTE_WS == '1') {
					require(['N/http'], function(http) {
						objAutCbtsAsinc    =
						http.post({
							url: URL_CER_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}else if(AMBIENTE_WS == '2'){
					require(['N/https'], function(https) {
						objAutCbtsAsinc    =
						https.post({
							url: URL_PD_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}

				if( objAutCbtsAsinc.code != 200 ) throw "Código de error " + objAutCbtsAsinc.code + " en el método AutorizarComprobantesAsincronico' de la consulta de WebService";

				var ObjXMLResponse = xml.Parser.fromString({text:objAutCbtsAsinc.body}) ;
				var StringResponse = ObjXMLResponse.getElementsByTagName( {tagName: 'AutorizarComprobantesAsincronicoResult'} )[0].textContent ;

				var ObjXMLSalidaTransaccion = xml.Parser.fromString({text:StringResponse}) ;

				TransaccionId = parseInt( ObjXMLSalidaTransaccion.getElementsByTagName( {tagName: 'ID'} )[0].textContent );
				if( isNaN(TransaccionId) ) throw "El valor del ID de la transacción obtenido no es de tipo numérico.";
				if( TransaccionId <= 0   ) throw "El valor del ID de la transacción obtenido es Cero";

	    		rec.setValue('custbody_nch_state_send' , 2 			   );
	          	rec.setValue('custbody_nch_tran_id'	   , TransaccionId );
	          	rec.setValue('custbody_numero_doc'	   , numDoc 	   );

			    objRespuesta.Error   = false;
			}catch(e){
				objRespuesta.Error   = true;
				objRespuesta.Mensaje = String(e);
			}
			return objRespuesta;
		}

		function WSSalidaTransac(xmlEnvio){
			try{
				var objRespuesta = {};

				var StringXML = 
				'<?xml version="1.0" encoding="utf-8"?>'+
				'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
				'<soap:Body>'+
				'<SalidaTransaccion xmlns="http://comfiar.com.ar/webservice/">'+
				'<cuitId>'+cuitId+'</cuitId>'+
				'<transaccionId>'+TransaccionId+'</transaccionId>'+
				'<token>'+
				'<SesionId>'+SesionId+'</SesionId>'+
				'<FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
				'</token>'+
				'</SalidaTransaccion>'+
				'</soap:Body>'+
				'</soap:Envelope>'; 

				var soapHeaders = new Array(); 
				soapHeaders['Host'] 		  = HOST_WS;
				soapHeaders['Content-Type']   = 'text/xml; charset=utf-8'; 
				soapHeaders['Content-Length'] = 'length';
				soapHeaders['SOAPAction'] 	  = "http://comfiar.com.ar/webservice/SalidaTransaccion";

				var objSalidaTransac = '';
				if (AMBIENTE_WS == '1') {
					require(['N/http'], function(http) {
						objSalidaTransac    =
						http.post({
							url: URL_CER_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}else if(AMBIENTE_WS == '2'){
					require(['N/https'], function(https) {
						objSalidaTransac    =
						https.post({
							url: URL_PD_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}

				if( objSalidaTransac.code != 200 ) throw "Código de error " + objSalidaTransac.code + " en el método SalidaTransaccion de la consulta de WebService";

				var ObjXMLResponse = xml.Parser.fromString({text:objSalidaTransac.body}) ;
				var StringResponse = ObjXMLResponse.getElementsByTagName( {tagName: 'SalidaTransaccionResult'} )[0].textContent ;

				var ObjXMLSalidaTransaccion = xml.Parser.fromString({text:StringResponse}) ;

				var ElementosInfoConfiar = ObjXMLSalidaTransaccion.getElementsByTagName( {tagName: 'Respuesta'} );
				if( ElementosInfoConfiar.length == 0 ) throw "No existe el nodo Respuesta para obtener el estatus del comprobante en el método SalidaTransaccion";

				var estado = ElementosInfoConfiar[0].getElementsByTagName( {tagName: 'Resultado'} )[0].textContent;

				var ElementoTransaccion = ObjXMLSalidaTransaccion.getElementsByTagName( {tagName: 'Transaccion'} )[0];
				var dateCo = ElementoTransaccion.getElementsByTagName( {tagName: 'Fecha' } )[0].textContent;

				//LOG DE SEGUIMIENTO COMFIAR
				var logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
				logRecord.setValue('custrecord_nch_envio_subsi', subsi);
				logRecord.setValue('custrecord_nch_envio_user', runtime.getCurrentUser().id);
				logRecord.setValue('custrecord_nch_envio_transac', internalId);
				logRecord.setValue('custrecord_nch_envio_estado', "COMFIAR :"+" "+estado+" "+dateCo);
				logRecord.setValue('custrecord_nch_envio_descri', StringResponse);
				logRecord.setValue('custrecord_nch_envio_identy', TransaccionId+" "+ numDoc);
				logRecord.setValue('custrecord_nch_envio_tipdoc', codDoc);
				logRecord.setValue('custrecord_nch_sesion_id', SesionId);
				logRecord.setValue('custrecord_date_token', FechaVencimiento);
				logRecord.save();

				estado_comfiar = estado;
				date_comfiar   = dateCo;

				if (estado != 'A' && estado != 'O') {
					rec.setValue('custbody_nch_state_send', 1);
					rec.setValue('custbody_nch_tran_id', null);
					rec.setValue('custbody_numero_doc', null);

					identifydoc = StringResponse.split('Id>')[1];
					mesagedoc   = StringResponse.split('Descripcion>')[1];
					grabaEstadoProveedor();
					sendMail(xmlEnvio, StringResponse, null, null, Sender, Semail);
					throw "El XML fue rechazado por el Proveedor.";
				}

				rec.setValue('custbody_nch_state_send', 3);
				rec.setValue('custbody_state_comfiar_pe', estado_comfiar);
				rec.setValue('custbody_date_comfiar_pe', date_comfiar);


				objRespuesta.Error = false;
				objRespuesta.Datos = StringResponse;
			}catch(e){
				objRespuesta.Error   = true;
				objRespuesta.Mensaje = String( e );
				objRespuesta.Datos   = objSalidaTransac.body;
			}
			return objRespuesta;
		}

		function WSRespCbte(xmlEnvio, StringResponse){
			try{
				var objRespuesta = {};

				var StringXML = 
				'<?xml version="1.0" encoding="utf-8"?>'+
				'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
				'<soap:Body>'+
				'<RespuestaComprobante xmlns="http://comfiar.com.ar/webservice/">'+
				'<cuitId>'+cuitId+'</cuitId>'+
				'<puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
				'<tipoDeComprobanteId>'+codDoc+'</tipoDeComprobanteId>'+
				'<nroCbte>'+numDoc+'</nroCbte>'+
				'<token>'+
				'<SesionId>'+SesionId+'</SesionId>'+
				'<FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
				'</token>'+
				'</RespuestaComprobante>'+
				'</soap:Body>'+
				'</soap:Envelope>';

				var soapHeaders = new Array(); 
				soapHeaders['Host'] = HOST_WS;
				soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
				soapHeaders['Content-Length'] = 'length';
				soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/RespuestaComprobante";

				var objRespCbte = '';

				sleep(2000);

				if (AMBIENTE_WS == '1') {
					require(['N/http'], function(http) {
						objRespCbte    =
						http.post({
							url: URL_CER_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}else if(AMBIENTE_WS == '2'){
					require(['N/https'], function(https) {
						objRespCbte    =
						https.post({
							url: URL_PD_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}

				if( objRespCbte.code != 200 ) throw "Código de error " + objRespCbte.code + " en el método RespuestaComprobante de la consulta de WebService";

				var ObjXMLResponse = xml.Parser.fromString({text:objRespCbte.body}) ;
				var returnRespCbte = ObjXMLResponse.getElementsByTagName( {tagName: 'RespuestaComprobanteResult'} )[0].textContent;

				var estado2 = returnRespCbte.split('Resultado>')[1];
				var keydgt  = returnRespCbte.split('Autorizacion>')[1];

				if(estado2 != null && estado2 != '')
				{
					estado2 = estado2.substring(0, estado2.length-2);
					keydgt = keydgt.substring(0, keydgt.length-2);
				}

				//LOG SEGUIMIENTO SUNAT
				var logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
				logRecord.setValue('custrecord_nch_envio_subsi', subsi);
				logRecord.setValue('custrecord_nch_envio_user', runtime.getCurrentUser().id);
				logRecord.setValue('custrecord_nch_envio_transac', internalId);
				logRecord.setValue('custrecord_nch_envio_estado', "DGT :"+ " "+keydgt);
				logRecord.setValue('custrecord_nch_envio_descri', returnRespCbte);
				logRecord.setValue('custrecord_nch_envio_identy', TransaccionId+" "+ numDoc);
				logRecord.setValue('custrecord_nch_envio_tipdoc', codDoc);
				logRecord.setValue('custrecord_nch_envio_folio', serDoc+" "+puntoDeVentaIdWS);
				logRecord.setValue('custrecord_nch_sesion_id', SesionId);
				logRecord.setValue('custrecord_date_token', FechaVencimiento);
				logRecord.save();

				estado_dgt = keydgt;

				if ( estado2 != 'A' && estado2 != 'O' ) {

					rec.setValue('custbody_nch_state_send', 1);
					rec.setValue('custbody_nch_tran_id', null);	
					rec.setValue('custbody_numero_doc', null);

					var idenficaS = returnRespCbte.split('Id>')[1];
					var mensageS  = returnRespCbte.split('Descripcion>')[1];

					identifydoc = idenficaS;
					mesagedoc   = mensageS;

					grabaEstadoEntidadFiscal();
					sendMail(xmlEnvio, StringResponse, returnRespCbte, null, Sender, Semail);
					throw "El XML fue rechazado por la Entidad Fiscal.";

				}


				rec.setValue('custbody_nch_state_send', 4);
				rec.setValue('custbody_state_sunat_pe', estado_dgt);



				objRespuesta.Error = false;
				objRespuesta.Datos = returnRespCbte;
			}catch(e){
				objRespuesta.Error   = true;
				objRespuesta.Mensaje = String( e );
				objRespuesta.Datos   = objRespCbte.body;
			}
			return objRespuesta;
		}

		function WSUltimoNroCbte(){
			try{
				var objRespuesta = {};

				var StringXML = 
				'<?xml version="1.0" encoding="utf-8"?>'+
				'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
				'  <soap:Body>'+
				'    <UltimoNumeroComprobante xmlns="http://comfiar.com.ar/webservice/">'+
				'      <cuitId>'+cuitId+'</cuitId>'+
				'      <puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
				'      <tipoDeComprobanteId>'+codDoc+'</tipoDeComprobanteId>'+
				'      <token>'+
				'        <SesionId>'+SesionId+'</SesionId>'+
				'        <FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
				'      </token>'+
				'    </UltimoNumeroComprobante>'+
				'  </soap:Body>'+
				'</soap:Envelope>';

				var soapHeaders = new Array(); 
				soapHeaders['Host'] = HOST_WS;
				soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
				soapHeaders['Content-Length'] = 'length';
				soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/UltimoNumeroComprobante";

				var returnUltimoNroCbte = '';
				if (AMBIENTE_WS == '1') {
					require(['N/http'], function(http) {
						returnUltimoNroCbte    =   
						http.post({
							url: URL_CER_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}else if(AMBIENTE_WS == '2'){
					require(['N/https'], function(https) {
						returnUltimoNroCbte    =   
						https.post({
							url: URL_PD_WS,
							body: StringXML,
							headers: soapHeaders
						});
					});
				}

				if( returnUltimoNroCbte.code != 200 ) throw "Código de error " + returnUltimoNroCbte.code + " en el método UltimoNumeroComprobante de la consulta de WebService.";

				var ObjXMLResponse = xml.Parser.fromString({text:returnUltimoNroCbte.body}) ;

				var UltimoNroCbteResult = parseInt( ObjXMLResponse.getElementsByTagName( {tagName: 'UltimoNumeroComprobanteResult'} )[0].textContent );
				if( isNaN(UltimoNroCbteResult) ) throw "El valor de comprobante obtenido no es del tipo numérico.";

				var secuencial = UltimoNroCbteResult + 1;
				var pad    = "0000000000";
				numDoc     = String( pad + String( secuencial ) ).substr(-10);

				objRespuesta.Error = false;
			}catch(e){
				objRespuesta.Error   = true;
				objRespuesta.Mensaje = String(e);
			}

			return objRespuesta;
		}

		function WSDescargarPdf(){

			var StringXML = 
			'<?xml version="1.0" encoding="utf-8"?>'+
			'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
			'  <soap:Body>'+
			'    <DescargarPdf xmlns="http://comfiar.com.ar/webservice/">'+
			'      <transaccionId>'+TransaccionId+'</transaccionId>'+
			'      <cuitId>'+cuitId+'</cuitId>'+
			'      <puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
			'      <tipoComprobanteId>'+codDoc+'</tipoComprobanteId>'+
			'      <numeroComprobante>'+numDoc+'</numeroComprobante>'+
			'      <token>'+
			'        <SesionId>'+SesionId+'</SesionId>'+
			'        <FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
			'      </token>'+
			'    </DescargarPdf>'+
			'  </soap:Body>'+
			'</soap:Envelope>';

			var soapHeaders = new Array(); 
			soapHeaders['Host'] = HOST_WS;
			soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
			soapHeaders['Content-Length'] = 'length';
			soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/DescargarPdf";

			var returnDescargarPdf = '';
			if (AMBIENTE_WS == '1') {
				require(['N/http'], function(http) {
					returnDescargarPdf    =   
					http.post({
						url: URL_CER_WS,
						body: StringXML,
						headers: soapHeaders
					});
				});
			}else if(AMBIENTE_WS == '2'){
				require(['N/https'], function(https) {
					returnDescargarPdf    =   
					https.post({
						url: URL_PD_WS,
						body: StringXML,
						headers: soapHeaders
					});
				});
			}

			var DescargarPdfResult = returnDescargarPdf.body.split('DescargarPdfResult')[1];
			if(DescargarPdfResult != null && DescargarPdfResult != ''){
				PDF = DescargarPdfResult.substring(1, DescargarPdfResult.length-2);

				}

			return returnDescargarPdf.body;
		}

		function WSDescargarXML(){
		
		try
			{

			var objRespuesta = {};

			var StringXML = 
			'<?xml version="1.0" encoding="utf-8"?>'+
			'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'+
			'  <soap:Body>'+
			'    <DescargarXml xmlns="http://comfiar.com.ar/webservice/">'+
			'      <transaccionId>'+TransaccionId+'</transaccionId>'+
			'      <cuitId>'+cuitId+'</cuitId>'+
			'      <puntoDeVentaId>'+puntoDeVentaIdWS+'</puntoDeVentaId>'+
			'      <tipoComprobanteId>'+codDoc+'</tipoComprobanteId>'+
			'      <numeroComprobante>'+numDoc+'</numeroComprobante>'+
			'      <token>'+
			'        <SesionId>'+SesionId+'</SesionId>'+
			'        <FechaVencimiento>'+FechaVencimiento+'</FechaVencimiento>'+
			'      </token>'+
			'    </DescargarXml>'+
			'  </soap:Body>'+
			'</soap:Envelope>';

			var soapHeaders = new Array(); 
				soapHeaders['Host'] = HOST_WS;
				soapHeaders['Content-Type'] = 'text/xml; charset=utf-8'; 
				soapHeaders['Content-Length'] = 'length';
				soapHeaders['SOAPAction'] = "http://comfiar.com.ar/webservice/DescargarXml";
 		    

			var url = (AMBIENTE_WS == '1')? URL_CER_WS : URL_PD_WS;

	        var returnXML = https.post({
				url     : url,
				body 	: StringXML,
				headers : soapHeaders
			});

	        if( returnXML.code != 200 ) throw "Código de error " + returnXML.code + " en el método Obtener_XML de la consulta de WebService: "+returnXML.body;

			var ObjXMLResponse = xml.Parser.fromString({text:returnXML.body}) ;
			var respuesta = (ObjXMLResponse.getElementsByTagName( {tagName: 'DescargarXmlResult'} ).length > 0)? ObjXMLResponse.getElementsByTagName( {tagName: 'DescargarXmlResult'} )[0].textContent : '' ;

			if( respuesta == '' || respuesta == null ) throw respuesta;

			var XMLBase64 = ObjXMLResponse.getElementsByTagName( {tagName: 'DescargarXmlResult'} )[0].textContent ;

			var guardaXML = guardaArchivo(encode.convert({string:XMLBase64, inputEncoding:encode.Encoding.BASE_64, outputEncoding:encode.Encoding.UTF_8}), 'xml', file.Type.XMLDOC);
			if( guardaXML.Error != false ) throw guardaXML.Mensaje;
          
          	//SAVE FILE IN TRASACTION
	        var idtran = guardaXML.Datos;
	        rec.setValue('custbody_electronic_xml', idtran);
	        rec.setValue('custbody_nch_state_send', 5);
          
          	logRecord = record.create({type: 'customrecord_nch_lote_envio_ei'});
				logRecord.setValue('custrecord_nch_envio_descri', 'id Archivo: '+idtran );
				logRecord.save();


	        objRespuesta.Error = false;
			}
			catch(error)
			{
			objRespuesta.Error = true;
			objRespuesta.Mensaje = String(error);
			}
			return objRespuesta;
		}

		function guardaArchivo( StringFileBase64, extension, tipoArchivo ) {
		try
		{
			
			var objRespuesta = {};
			//SAVE FILE IN NETSUITE
			var fileObj = file.create({
				name     : tranprefix+' '+serDoc+puntoDeVentaIdWS+codDoc+numDoc + '.' + extension,
				fileType : tipoArchivo,
				contents : StringFileBase64
			});
	          
			fileObj.folder = 2681223;
	       	 
			var id = fileObj.save();
			fileObj = file.load( {id:id} );

			objRespuesta.Error = false;
			objRespuesta.Datos = fileObj.id;
		}catch(error)
		{
			objRespuesta.Error = true;
			objRespuesta.Mensaje = String( error );
		}

		return objRespuesta;
		}

		function sendMail(content, WSSalidaTransac, WSRespCbte, PDF, userlog, maillog){

			var currentuser = runtime.getCurrentUser().id;
			var emailUser   = runtime.getCurrentUser().email;
			//var currentuser = userlog;
			//var emailUser   = maillog;
			var today = new Date();

			var recEmp = search.lookupFields({
				type: search.Type.EMPLOYEE,
				id: currentuser,
				columns: 'firstname'
			});
			var nameUser    = recEmp.firstname;

			var body =  '<table style="border:lightgrey 15px solid;" width="750">';
			body += '<td style="padding-left:13pt; padding-right:13pt; padding-bottom:13pt; color:#585858; font-size:15px;">';
			body += '<img src="https://checkout.na1.netsuite.com/core/media/media.nl?id=1636345&c=3574893&h=3c7604ee19ca18e025fd" width="125" height="125" />';
			body += '<hr>';
			body += '<p><span style="color:#01A9DB; font-size:16px;"><b>Estimad(@) :</b></span></p>';
			body += '<hr>';
			body += '<p style="padding-bottom:12px;">Mensaje Automatico desde NetSuite Electronic Invoicing App. </p>';
			if (rec.getValue('custbody_nch_state_send') >= 3) {
				body += '<p>Se ha generado el Documento Electronico <b>' + typedoc+'-'+numDoc + '</b> con Internal ID <b>' + internalId + '</b>.</p>';
			}else{
				body += '<p>Mensaje de error automático de NCH SuiteApp.</p>';
				body += '<p>Se produjo un error al emitir el Documento Electronico <b>' + typedoc+'-'+numDoc + '</b> con Internal ID <b>' + internalId + '</b>.</p>';
				body += '<p>Por favor, comunícate con nuestro departamento de Desarrollo a: jonathan.jimenez@nch.com</p>';
				body += '<p>Nosotros nos encargamos.</p>';
			}
			body += '<br>';
			body += '<p>Saludos Cordiales,</p>';
			body += 'El equipo de NCH CORPORATION';
			body += '<br>';
			body += '<a style="font-size:13px" href="http://www.nch.com/">www.nch.com</a>';
			body += '<br><br>';
			body += '<p><strong>*** NO RESPONDA A ESTE MENSAJE ***</strong></p>';
			body += '<br>';
			body += '<hr>'; 
			body += '<br><br>';
			body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=552&c=TSTDRV1038915&h=d2823d71514640fd9a37" align="right"/>';
			body += '</td>';
			body += '</table>';	
			body += '</body>';

			var fileXML = new Array();
			//var FileName = 'Archivo Facturacion Electronica ' + today +'.CSV';

			var i = 0;
			var FileName = 'XML Request NCH CR.ftl';

			if(content != null && content != ''){
				fileXML[0] = file.create({
					name    : FileName,
					fileType: file.Type.FREEMARKER,
					contents: content
				});
				i++;
			}
			if(WSSalidaTransac != null && WSSalidaTransac != ''){
				fileXML[i] = file.create({
					name    : "Response Transaccion COMFIAR.xml",
					fileType: file.Type.XMLDOC,
					contents: WSSalidaTransac
				});
				i++;
			}
			if(WSRespCbte != null && WSRespCbte != ''){
				fileXML[i] = file.create({
					name    : "Response Transaccion DGT.xml",
					fileType: file.Type.XMLDOC,
					contents: WSRespCbte
				});
				i++;
			}
			if(PDF != null && PDF != ''){
				fileXML[i] = file.create({
					name    : "Response PDF.pdf",
					fileType: file.Type.PDF,
					contents: PDF
				});
				i++;
			}
			//fileXML[0].save();
			var subject = '';
			if (codDoc == '01') {
				subject = "NCH - Factura Electrónica CR: F " +numDoc;
			}else if (codDoc == '02') {
				subject = "NCH - Nota de Debito Electrónica CR: ND" +numDoc;
			}

			email.send({
				author: currentuser,
	            //recipients: emailUser,
	            recipients: ['jonathan.jimenez@nch.com'],
	            cc: ['plara@nch.com'],
	            subject: subject,
	            body: body,
	            attachments: fileXML
	        });
		}



		function getEnableFeatures(){

		    // Registro Personalizado NCH Enable Feature Acces CL 

		    var HostSandbox = 'demo.comfiar.co.cr';
		    var HostProduct = 'app.comfiar.co.cr';

		    busqEnabFet = search.create({
		    	type: 'customrecord_nch_cl_enable_acces',
		    	columns: ['custrecord_cl_fel_usuario_ws', 'custrecord_cl_fel_password_ws', 'custrecord_cl_fel_url_acceso_ws',
		    	'custrecord_cl_url_cargaemite_ws', 'custrecord_cl_ambiente_ws', 'custrecord_cl_fel_host_ws', 
		    	'custrecord_cl_formatoid_ws','custrecord_cl_fel_usuariocliente_ws']});
		    resultEnabFet = busqEnabFet.run().getRange(0, 10);
          
          	if(resultEnabFet != null && resultEnabFet.length > 0){
                row  = resultEnabFet[0].columns;
                for (var i = 0; i < resultEnabFet.length; i++) {
                    if( resultEnabFet[i].getValue(row[5]) == HostProduct )
                    {
                        USER		= resultEnabFet[i].getValue(row[0]);
                        PASSWORD    = resultEnabFet[i].getValue(row[1]);
                        URL_PD_WS   = resultEnabFet[i].getValue(row[2]);
                        URL_CER_WS  = resultEnabFet[i].getValue(row[3]);
                        AMBIENTE_WS = resultEnabFet[i].getValue(row[4]);
                        HOST_WS     = resultEnabFet[i].getValue(row[5]);
                        FORMATO_WS  = resultEnabFet[i].getValue(row[6]);
                        cuitId		= resultEnabFet[i].getValue(row[7]);
                        break;
                    }
                }
            }
		}


		function sleep(milliseconds) {
			var start = new Date().getTime();
			for (var i = 0; i < 1e7; i++) {
				if ((new Date().getTime() - start) > milliseconds){
					break;
				}
			}
		}

		return{
			send: send
		};
});