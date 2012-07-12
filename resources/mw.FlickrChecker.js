( function( mw, $ ) {


mw.FlickrChecker = function( wizard, url, $selector, upload ){

this.wizard = wizard;
this.url = url;
this.upload = upload;
this.image_uploads = [];
this.apiUrl = mw.UploadWizard.config['flickrapiUrl'];
this.apiKey = mw.UploadWizard.config['flickrapiKey'];
_this = this;
};

mw.FlickrChecker.prototype = {
	licenseList: new Array(),
	// Map each Flickr license name to the equivalent templates.
	// These are the current Flickr license names as of April 26, 2011.
	// Live list at http://api.flickr.com/services/rest/?&method=flickr.photos.licenses.getInfo&api_key=e9d8174a79c782745289969a45d350e8
	licenseMaps: {
		'All Rights Reserved': 'invalid',
		'Attribution License': '{{flickrreview}}{{cc-by-2.0}}',
		'Attribution-NoDerivs License': 'invalid',
		'Attribution-NonCommercial-NoDerivs License': 'invalid',
		'Attribution-NonCommercial License': 'invalid',
		'Attribution-NonCommercial-ShareAlike License': 'invalid',
		'Attribution-ShareAlike License': '{{flickrreview}}{{cc-by-sa-2.0}}',
		'No known copyright restrictions': '{{flickrreview}}{{Flickr-no known copyright restrictions}}',
		'United States Government Work': '{{flickrreview}}{{PD-USGov}}'
	},

	/**
	 * If a photo is from flickr, retrieve its license. If the license is valid, display the license
	 * to the user, hide the normal license selection interface, and set it as the deed for the upload.
	 * If the license is not valid, alert the user with an error message. If no recognized license is
	 * retrieved, do nothing. Note that the license look-up system is fragile on purpose. If Flickr
	 * changes the name associated with a license ID, it's better for the lookup to fail than to use
	 * an incorrect license.
 	 * @param url - the source URL to check
 	 * @param $selector - the element to insert the license name into
 	 * @param upload - the upload object to set the deed for
	 */
	checkFlickr: function() {
		var photoIdMatches = _this.url.match(/flickr.com\/photos\/[^\/]+\/([0-9]+)/);
		var albumIdMatches = _this.url.match(/flickr.com\/photos\/[^\/]+\/sets\/([0-9]+)/); 
		$j( '#mwe-upwiz-upload-add-flickr-container' ).hide();

		if ( albumIdMatches && albumIdMatches[1] > 0 ) {
			$j( '#mwe-upwiz-select-flickr' ).button( { label:gM( 'mwe-upwiz-select-flickr' ) } );
			$j( '#mwe-upwiz-flickrSelectlistContainer' ).show();
			$.getJSON( _this.apiUrl, { 'nojsoncallback': 1, 'method': 'flickr.photosets.getPhotos', 'api_key': _this.apiKey, 'photoset_id': albumIdMatches[1], 'format': 'json', 'extras': 'license, url_sq' },
				function( data ) {
					$.each( data.photoset.photo, function( i, item ) {
						var license = _this.checkLicense( item.license, i );
						var licenseValue = license.licenseValue;
						if ( licenseValue != 'invalid' ) {
							var flickr_upload = {
								name : item.title + '.JPG',
								url : '',
								fromURL : true,
								licenseValue : licenseValue,
								licenseMessage : license.licenseMessage,
								license : true,
								photoId : item.id, 
								index : i
							}
							//Adding all the Photoset files which have a valid license with the required info to an array so that they can be referenced later
							_this.image_uploads.push( flickr_upload );
							
							//setting up the thumbnail previews in the Selection list
							if ( item.url_sq ) {
								var image_container = '<li id="upload-' + i +'" class="ui-state-default"><img src="' + item.url_sq + '"></li>';
								$( '#mwe-upwiz-flickrSelectlist' ).append( image_container );
							}
						}
					} );
					
					//Calling jquery ui selectable 
					$j( "#mwe-upwiz-flickrSelectlist" ).selectable();
					$j( '#mwe-upwiz-select-flickr' ).click( function() {
						$j( '#mwe-upwiz-flickrSelectlistContainer' ).hide();
						$j( '#mwe-upwiz-upload-ctrls' ).show();
						$j( '.ui-selected' ).each( function( index, value ) {
							value = $( this ).attr( 'id' );
							value = value.split( '-' )[1];
							_this.setImageURL( value, _this );
						} );
					} );
				} );
		}
		
		if ( photoIdMatches && photoIdMatches[1] > 0 ) {
			var photoId = photoIdMatches[1];
			$.getJSON( this.apiUrl, { 'nojsoncallback': 1, 'method': 'flickr.photos.getInfo', 'api_key': this.apiKey, 'photo_id': photoId, 'format': 'json' },
				function( data ) {
					if ( typeof data.photo != 'undefined' ) {
						var license = _this.checkLicense( data.photo.license );
						var licenseValue = license.licenseValue;
						if ( licenseValue != 'invalid' ) {
							var flickr_upload = {
								name : data.photo.title._content + '.JPG',
								url : '',
								type : 'JPEG',
								fromURL : true,
								licenseValue : licenseValue,
								licenseMessage : licenseMessage,
								license : true,
								photoId : data.photo.id
							}
							_this.image_uploads.push( flickr_upload );
							_this.setImageURL( 0, _this );
						} else {
							// Do something here
						}
					}
				}
			);
		}
	},

	/**
	 * Retrieve the list of all current Flickr licenses and store it in an array (mw.FlickrChecker.licenseList)
	 */
	getLicenses: function() {
		$.getJSON( _this.apiUrl, { 'nojsoncallback': 1, 'method': 'flickr.photos.licenses.getInfo', 'api_key': _this.apiKey, 'format': 'json' },
			function( data ) {
				if ( typeof data.licenses != 'undefined' ) {
					$.each( data.licenses.license, function( index, value ) {
						mw.FlickrChecker.prototype.licenseList[value.id] = value.name;
					} );
				}
			$j( 'body' ).trigger( 'licenselistfilled' );
			}
		);
	},

	setImageURL : function( index, _this ) {
		// Passing _this as there was an error as to where _this points when not passed explicitly.
		var _this = _this;
		var image_url = '';
		var photoId = _this.image_uploads[index].photoId;
		
		$.getJSON( this.apiUrl, { 'nojsoncallback': 1, 'method': 'flickr.photos.getSizes', 'api_key': this.apiKey, 'format': 'json', 'photo_id': photoId },
			function( data ) {
				$.each( data.sizes.size, function( index, item ) {
					image_url = item.source;
				} );
				_this.image_uploads[index].url = image_url;

				//Need to call the newUpload here because else some code would have to be written completion of the API call. 
				_this.wizard.newUpload( _this.image_uploads[index] );
			} );
	},

	checkLicense : function( licenseId ){
		// The returned data.photo.license is just an ID that we use to look up the license name
		var licenseName = mw.FlickrChecker.prototype.licenseList[licenseId];

		// Use the license name to retrieve the template values
		var licenseValue = mw.FlickrChecker.prototype.licenseMaps[licenseName];

		// Set the license message to show the user.
		if ( licenseValue == 'invalid' ) {
			licenseMessage = gM( 'mwe-upwiz-license-external-invalid', 'Flickr', licenseName );
		} else {
			licenseMessage = gM( 'mwe-upwiz-license-external', 'Flickr', licenseName );
		}
		var license = {
			licenseName : licenseName,
			licenseMessage : licenseMessage, 
			licenseValue : licenseValue
		}
		return license;
	},

};

} )( window.mediaWiki, jQuery );
